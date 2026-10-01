"""Public voice proxy (D-53, #126): `POST /api/voice/transcribe` and `POST /api/voice/speak`.

The browser records and plays audio; OpenRouter does the speech work; the key stays here. Both
endpoints are public (no token, like the Showcase) and share one per-IP sliding-window limit.
Audio bytes, transcribed text and upstream bodies are never logged: only a status code or an
exception class name.

Transcribe checks, in order: configured (503), rate limit (429), content type (415), declared
`Content-Length` (413, before any byte is read), bytes actually read (413), empty body (422).
Speak runs the same configured and rate-limit checks first, then reads at most 32 KB (413) and
only then validates `{text}` (422, with a fixed message that never echoes the input).
Cheap refusals come first; the limit counts every request that gets past configuration, whatever
its later fate, so a client cannot probe for free with malformed calls.

The limit keys on the client IP: the TCP peer by default, or, with `VOICE_TRUSTED_PROXY_HOPS=N`,
the Nth `X-Forwarded-For` entry from the right, the one our own proxy appended. Entries to its
left are written by the client and never trusted. At most `MAX_LIMITER_KEYS` addresses are
tracked; when the table is full and no emptied window can be swept, a new address gets 429.
"""

from __future__ import annotations

import logging
from collections import deque
from collections.abc import Callable
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

from app.config import Settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024
# `{text}` of at most 4096 characters fits easily, even as multi-byte UTF-8 with JSON escapes.
MAX_SPEAK_BYTES = 32 * 1024
# Hard cap on tracked client addresses, so the limiter's memory is bounded whatever arrives.
MAX_LIMITER_KEYS = 10_000
# The recording types the browser's MediaRecorder produces, mapped to the upload extension.
AUDIO_EXTENSIONS = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
}
UPSTREAM_TIMEOUT = httpx.Timeout(30.0, connect=5.0)
RATE_WINDOW_SECONDS = 60.0

NOT_CONFIGURED = "voice not configured"
UNAVAILABLE = "voice provider unavailable"
SPEAK_INVALID = "text: must be a JSON object with text of 1 to 4096 characters"


class SpeakRequest(BaseModel):
    """Local to the voice router on purpose: app/models is the frozen contract (D-51)."""

    text: str = Field(min_length=1, max_length=4096)


class Transcript(BaseModel):
    text: str


class SlidingWindowLimiter:
    """At most `limit` hits per key in any `window` seconds. In memory, per process: it resets on
    restart and is not shared across replicas, which is enough for one engine instance.

    At most `MAX_LIMITER_KEYS` keys are tracked. A new key that finds the table full triggers a
    sweep of keys whose window has emptied, at most once per window; if the table is still full,
    the key is refused (fail closed), so memory stays bounded under a flood of addresses."""

    def __init__(
        self,
        limit: int,
        now: Callable[[], float],
        window: float = RATE_WINDOW_SECONDS,
        max_keys: int | None = None,
    ) -> None:
        self._limit = limit
        self._now = now
        self._window = window
        self._max_keys = MAX_LIMITER_KEYS if max_keys is None else max_keys
        self._hits: dict[str, deque[float]] = {}
        self._last_sweep = float("-inf")

    def allow(self, key: str) -> bool:
        now = self._now()
        cutoff = now - self._window
        hits = self._hits.get(key)
        if hits is None:
            if len(self._hits) >= self._max_keys and now - self._last_sweep >= self._window:
                self._last_sweep = now
                self._hits = {k: q for k, q in self._hits.items() if q and q[-1] > cutoff}
            if len(self._hits) >= self._max_keys:
                return False
            hits = self._hits[key] = deque()
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= self._limit:
            return False
        hits.append(now)
        return True


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _client(request: Request) -> httpx.AsyncClient:
    client: httpx.AsyncClient = request.app.state.voice_http
    return client


def client_ip(request: Request, trusted_hops: int) -> str:
    """The TCP peer, or with `trusted_hops` N > 0 the Nth `X-Forwarded-For` entry from the right
    (appended by our own proxy). Too few entries, or no header, falls back to the peer."""
    peer = request.client.host if request.client else "unknown"
    if trusted_hops <= 0:
        return peer
    forwarded = ",".join(request.headers.getlist("x-forwarded-for"))
    entries = [entry.strip() for entry in forwarded.split(",") if entry.strip()]
    if len(entries) < trusted_hops:
        return peer
    return entries[-trusted_hops]


def _enforce_limit(request: Request) -> None:
    limiter: SlidingWindowLimiter = request.app.state.voice_limiter
    key = client_ip(request, _settings(request).voice_trusted_proxy_hops)
    if not limiter.allow(key):
        raise HTTPException(status_code=429, detail="too many voice requests")


async def transcribe_guard(request: Request) -> Settings:
    settings = _settings(request)
    if settings.openrouter_api_key is None or settings.voice_stt_model is None:
        raise HTTPException(status_code=503, detail=NOT_CONFIGURED)
    _enforce_limit(request)
    return settings


async def speak_guard(request: Request) -> Settings:
    """Runs before `speak` reads the body, so an oversized or invalid one still counts toward the
    limit. Async (like `transcribe_guard`) so the limiter is only ever touched on the event loop."""
    settings = _settings(request)
    if (
        settings.openrouter_api_key is None
        or settings.voice_tts_model is None
        or settings.voice_tts_voice is None
    ):
        raise HTTPException(status_code=503, detail=NOT_CONFIGURED)
    _enforce_limit(request)
    return settings


def _unavailable(
    endpoint: str, *, status: int | None = None, error: Exception | None = None
) -> HTTPException:
    if status is not None:
        logger.warning("voice %s: upstream answered %d", endpoint, status)
    else:
        logger.warning("voice %s: upstream failed (%s)", endpoint, type(error).__name__)
    return HTTPException(status_code=502, detail=UNAVAILABLE)


async def _read_capped(
    request: Request, limit: int = MAX_AUDIO_BYTES, detail: str = "recording over 5 MB"
) -> bytes:
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > limit:
                raise HTTPException(status_code=413, detail=detail)
        except ValueError:
            pass  # Unparseable header: the running count below still enforces the cap.
    received = bytearray()
    async for chunk in request.stream():
        received += chunk
        if len(received) > limit:
            raise HTTPException(status_code=413, detail=detail)
    return bytes(received)


@router.post("/transcribe", response_model=Transcript)
async def transcribe(
    request: Request,
    settings: Annotated[Settings, Depends(transcribe_guard)],
    client: Annotated[httpx.AsyncClient, Depends(_client)],
) -> Transcript:
    """The raw recording as the body, its type in `Content-Type`; answers `{text}`."""
    mime = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    extension = AUDIO_EXTENSIONS.get(mime)
    if extension is None:
        raise HTTPException(status_code=415, detail="unsupported audio type")
    audio = await _read_capped(request)
    if not audio:
        raise HTTPException(status_code=422, detail="empty recording")

    try:
        response = await client.post(
            "/audio/transcriptions",
            files={"file": (f"audio.{extension}", audio, mime)},
            data={"model": settings.voice_stt_model},
        )
    except httpx.HTTPError as error:
        raise _unavailable("transcribe", error=error) from None
    if not response.is_success:
        raise _unavailable("transcribe", status=response.status_code)
    try:
        payload: Any = response.json()
    except ValueError as error:
        raise _unavailable("transcribe", error=error) from None
    text = payload.get("text") if isinstance(payload, dict) else None
    if not isinstance(text, str):
        logger.warning("voice transcribe: upstream body has no text")
        raise HTTPException(status_code=502, detail=UNAVAILABLE)
    return Transcript(text=text)


@router.post("/speak", response_class=Response)
async def speak(
    request: Request,
    settings: Annotated[Settings, Depends(speak_guard)],
    client: Annotated[httpx.AsyncClient, Depends(_client)],
) -> Response:
    """`{text}` (1–4096 characters) in, MP3 bytes out. The body is read only after the guard, at
    most `MAX_SPEAK_BYTES`, and validated here, so a bad one is never echoed back."""
    raw = await _read_capped(request, MAX_SPEAK_BYTES, "request over 32 KB")
    try:
        body = SpeakRequest.model_validate_json(raw)
    except ValidationError:
        return JSONResponse(
            status_code=422, content={"type": "validation-error", "message": SPEAK_INVALID}
        )
    payload: dict[str, str] = {
        "model": settings.voice_tts_model or "",
        "input": body.text,
        "voice": settings.voice_tts_voice or "",
        "response_format": "mp3",
    }
    if settings.voice_tts_instructions is not None:
        payload["instructions"] = settings.voice_tts_instructions

    try:
        response = await client.post("/audio/speech", json=payload)
    except httpx.HTTPError as error:
        raise _unavailable("speak", error=error) from None
    if not response.is_success:
        raise _unavailable("speak", status=response.status_code)
    return Response(content=response.content, media_type="audio/mpeg")
