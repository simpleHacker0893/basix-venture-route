"""Seam (D-53): the public voice proxy over HTTP through `create_app`, with OpenRouter replaced by
an async `httpx.MockTransport` injected as `create_app(voice_transport=...)` (#126).

`POST /api/voice/transcribe` takes a raw recording and answers `{text}`; `POST /api/voice/speak`
takes `{text}` and answers MP3 bytes. Neither needs a token. The network is the one thing mocked:
the handler parses every forwarded request, so the tests see exactly what OpenRouter would. No
database is needed (`session_factory=None`), and audio or text never reaches the logs.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import UTC, datetime, timedelta
from email.parser import BytesParser
from email.policy import HTTP
from typing import Any

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.clerk import JwksCache
from app.config import Settings
from app.engine.metta_engine import MettaRouteEngine
from app.main import create_app
from tests.conftest import FakeClerkAdmin

pytestmark = pytest.mark.anyio

BASE_URL = "https://openrouter.test/api/v1"
KEY = "sk-or-test-key"
STT_MODEL = "openai/stt-test"
TTS_MODEL = "openai/tts-test"
VOICE = "nova"
INSTRUCTIONS = "Warm, clear, unhurried British English."

TRANSCRIBE = "/api/voice/transcribe"
SPEAK = "/api/voice/speak"

# Unique strings standing in for a founder's speech; they must never reach the logs.
AUDIO_MARKER = b"ZQX-AUDIO-MARKER-4412"
TEXT_MARKER = "ZQX-SPOKEN-TEXT-MARKER-9053"
AUDIO = b"\x1aE\xdf\xa3" + AUDIO_MARKER + b"\x00" * 64
MP3 = b"ID3\x04" + b"\xff\xfb" * 32

FIVE_MB = 5 * 1024 * 1024

Handler = Callable[[httpx.Request], httpx.Response]


def voice_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "llm_provider": "null",
        "openrouter_api_key": KEY,
        "openrouter_base_url": BASE_URL,
        "voice_stt_model": STT_MODEL,
        "voice_tts_model": TTS_MODEL,
        "voice_tts_voice": VOICE,
        "voice_tts_instructions": INSTRUCTIONS,
        "voice_rate_limit_per_minute": 100,
    }
    values.update(overrides)
    return Settings(**values)


class Upstream:
    """Stands in for OpenRouter: records every request, answers with the scripted handler."""

    def __init__(self, handler: Handler | None = None) -> None:
        self.requests: list[httpx.Request] = []
        self.handler = handler or default_handler

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        await request.aread()
        self.requests.append(request)
        return self.handler(request)


def default_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/audio/transcriptions"):
        return httpx.Response(200, json={"text": f"hello {TEXT_MARKER}", "usage": {}})
    return httpx.Response(200, content=MP3, headers={"content-type": "audio/mpeg"})


def multipart_parts(request: httpx.Request) -> dict[str, tuple[str | None, str, bytes]]:
    """name → (filename, content type, payload) for each part of a multipart body."""
    raw = b"Content-Type: " + request.headers["content-type"].encode() + b"\r\n\r\n"
    message = BytesParser(policy=HTTP).parsebytes(raw + request.content)
    parts: dict[str, tuple[str | None, str, bytes]] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        payload = part.get_payload(decode=True)
        assert isinstance(name, str) and isinstance(payload, bytes)
        parts[name] = (part.get_filename(), part.get_content_type(), payload)
    return parts


Client = Callable[..., AbstractAsyncContextManager[AsyncClient]]


@pytest.fixture
def make_client(engine: MettaRouteEngine) -> Client:
    """`async with make_client(settings, upstream) as api:` the real app, no store, no token."""

    @asynccontextmanager
    async def _client(
        settings: Settings,
        upstream: Upstream,
        clock: Callable[[], datetime] | None = None,
    ) -> AsyncIterator[AsyncClient]:
        app = create_app(
            settings,
            engine=engine,
            jwks_cache=JwksCache.empty(),
            session_factory=None,
            clerk_admin=FakeClerkAdmin(),
            clock=clock,
            voice_transport=httpx.MockTransport(upstream),
        )
        async with (
            app.router.lifespan_context(app),
            AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as api,
        ):
            yield api

    return _client


# -- transcribe -------------------------------------------------------------------------------


async def test_transcribe_forwards_multipart_with_filename_mime_and_model(
    make_client: Client,
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(
            TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm;codecs=opus"}
        )

    assert response.status_code == 200, response.text
    assert response.json() == {"text": f"hello {TEXT_MARKER}"}
    [sent] = upstream.requests
    assert str(sent.url) == f"{BASE_URL}/audio/transcriptions"
    assert sent.headers["authorization"] == f"Bearer {KEY}"
    parts = multipart_parts(sent)
    assert parts["file"] == ("audio.webm", "audio/webm", AUDIO)
    assert parts["model"][2] == STT_MODEL.encode()


@pytest.mark.parametrize(
    ("content_type", "filename", "mime"),
    [
        ("audio/mp4", "audio.mp4", "audio/mp4"),
        ("Audio/OGG; codecs=opus", "audio.ogg", "audio/ogg"),
        ("audio/mpeg", "audio.mp3", "audio/mpeg"),
    ],
)
async def test_transcribe_maps_each_allowed_type_to_its_extension(
    make_client: Client, content_type: str, filename: str, mime: str
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": content_type})

    assert response.status_code == 200, response.text
    file_name, file_mime, _ = multipart_parts(upstream.requests[0])["file"]
    assert (file_name, file_mime) == (filename, mime)


@pytest.mark.parametrize("content_type", ["audio/wav", "text/plain", "application/json", ""])
async def test_transcribe_rejects_other_content_types_with_415(
    make_client: Client, content_type: str
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": content_type})

    assert response.status_code == 415
    assert upstream.requests == []


async def test_transcribe_rejects_a_declared_length_over_5_mb_with_413(
    make_client: Client,
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(
            TRANSCRIBE,
            content=AUDIO,
            headers={"content-type": "audio/webm", "content-length": str(FIVE_MB + 1)},
        )

    assert response.status_code == 413
    assert upstream.requests == []


async def test_transcribe_rejects_a_body_over_5_mb_with_413(make_client: Client) -> None:
    async def chunks() -> AsyncIterator[bytes]:
        # Streamed without a Content-Length, so only the running count can catch it.
        for _ in range(6):
            yield b"\x00" * (1024 * 1024)

    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(
            TRANSCRIBE, content=chunks(), headers={"content-type": "audio/webm"}
        )

    assert response.status_code == 413
    assert upstream.requests == []


async def test_transcribe_accepts_exactly_5_mb(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(
            TRANSCRIBE, content=b"\x00" * FIVE_MB, headers={"content-type": "audio/webm"}
        )

    assert response.status_code == 200, response.text


async def test_transcribe_rejects_an_empty_body_with_422(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(TRANSCRIBE, content=b"", headers={"content-type": "audio/webm"})

    assert response.status_code == 422
    assert upstream.requests == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"openrouter_api_key": None},
        {"openrouter_api_key": "sk-or-replace-me"},
        {"voice_stt_model": ""},
    ],
)
async def test_transcribe_answers_503_when_not_configured(
    make_client: Client, overrides: dict[str, Any]
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(**overrides), upstream) as api:
        response = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})

    assert response.status_code == 503
    assert response.json() == {"detail": "voice not configured"}
    assert upstream.requests == []


@pytest.mark.parametrize(
    "handler",
    [
        lambda _: httpx.Response(500, json={"error": {"message": "boom"}}),
        lambda _: httpx.Response(200, json={"no": "text"}),
        lambda _: httpx.Response(200, content=b"not json"),
    ],
    ids=["upstream-500", "missing-text", "not-json"],
)
async def test_transcribe_answers_502_on_an_upstream_failure(
    make_client: Client, handler: Handler
) -> None:
    async with make_client(voice_settings(), Upstream(handler)) as api:
        response = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})

    assert response.status_code == 502
    assert response.json() == {"detail": "voice provider unavailable"}


async def test_transcribe_answers_502_on_a_timeout(make_client: Client) -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    async with make_client(voice_settings(), Upstream(timeout)) as api:
        response = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})

    assert response.status_code == 502
    assert response.json() == {"detail": "voice provider unavailable"}


# -- speak ------------------------------------------------------------------------------------


async def test_speak_forwards_model_voice_instructions_and_returns_mp3(
    make_client: Client,
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(SPEAK, json={"text": TEXT_MARKER})

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == MP3
    [sent] = upstream.requests
    assert str(sent.url) == f"{BASE_URL}/audio/speech"
    assert sent.headers["authorization"] == f"Bearer {KEY}"
    assert json.loads(sent.content) == {
        "model": TTS_MODEL,
        "input": TEXT_MARKER,
        "voice": VOICE,
        "instructions": INSTRUCTIONS,
        "response_format": "mp3",
    }


async def test_speak_omits_instructions_when_unset(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(voice_tts_instructions=""), upstream) as api:
        response = await api.post(SPEAK, json={"text": "Hello"})

    assert response.status_code == 200, response.text
    assert "instructions" not in json.loads(upstream.requests[0].content)


@pytest.mark.parametrize(
    "body", [{"text": ""}, {"text": "x" * 4097}, {}], ids=["empty", "long", "missing"]
)
async def test_speak_rejects_invalid_text_with_422(
    make_client: Client, body: dict[str, str]
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(SPEAK, json=body)

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert upstream.requests == []


async def test_speak_accepts_4096_characters(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(SPEAK, json={"text": "x" * 4096})

    assert response.status_code == 200, response.text


@pytest.mark.parametrize(
    "overrides",
    [{"openrouter_api_key": None}, {"voice_tts_model": ""}, {"voice_tts_voice": " "}],
)
async def test_speak_answers_503_when_not_configured(
    make_client: Client, overrides: dict[str, Any]
) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(**overrides), upstream) as api:
        response = await api.post(SPEAK, json={"text": "Hello"})

    assert response.status_code == 503
    assert response.json() == {"detail": "voice not configured"}
    assert upstream.requests == []


async def test_speak_answers_502_on_an_upstream_500(make_client: Client) -> None:
    upstream = Upstream(lambda _: httpx.Response(500, text="upstream exploded"))
    async with make_client(voice_settings(), upstream) as api:
        response = await api.post(SPEAK, json={"text": "Hello"})

    assert response.status_code == 502
    assert response.json() == {"detail": "voice provider unavailable"}


async def test_speak_answers_502_on_a_timeout(make_client: Client) -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    async with make_client(voice_settings(), Upstream(timeout)) as api:
        response = await api.post(SPEAK, json={"text": "Hello"})

    assert response.status_code == 502
    assert response.json() == {"detail": "voice provider unavailable"}


# -- shared: rate limit, logs, no auth ----------------------------------------------------------


async def test_the_limit_is_shared_by_both_endpoints_and_answers_429(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(voice_rate_limit_per_minute=3), upstream) as api:
        first = await api.post(SPEAK, json={"text": "one"})
        second = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})
        third = await api.post(SPEAK, json={"text": "three"})
        fourth = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})
        fifth = await api.post(SPEAK, json={"text": "five"})

    assert [r.status_code for r in (first, second, third)] == [200, 200, 200]
    assert (fourth.status_code, fifth.status_code) == (429, 429)
    assert len(upstream.requests) == 3


async def test_rejected_requests_count_toward_the_limit(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(voice_rate_limit_per_minute=2), upstream) as api:
        bad_type = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "text/plain"})
        bad_text = await api.post(SPEAK, json={"text": ""})
        good = await api.post(SPEAK, json={"text": "Hello"})

    assert (bad_type.status_code, bad_text.status_code, good.status_code) == (415, 422, 429)
    assert upstream.requests == []


async def test_the_window_slides_after_60_seconds(make_client: Client) -> None:
    now = [datetime(2026, 9, 23, 12, 0, tzinfo=UTC)]
    upstream = Upstream()
    async with make_client(
        voice_settings(voice_rate_limit_per_minute=1), upstream, clock=lambda: now[0]
    ) as api:
        first = await api.post(SPEAK, json={"text": "Hello"})
        now[0] += timedelta(seconds=59)
        blocked = await api.post(SPEAK, json={"text": "Hello"})
        now[0] += timedelta(seconds=2)
        after = await api.post(SPEAK, json={"text": "Hello"})

    assert (first.status_code, blocked.status_code, after.status_code) == (200, 429, 200)


async def test_audio_and_text_never_reach_the_logs(
    make_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)

    def failing(request: httpx.Request) -> httpx.Response:
        # The upstream body echoes the input; it must not be logged either.
        return httpx.Response(500, content=request.content)

    async with make_client(voice_settings(), Upstream(failing)) as api:
        heard = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})
        spoken = await api.post(SPEAK, json={"text": TEXT_MARKER})

    assert (heard.status_code, spoken.status_code) == (502, 502)
    assert "500" in caplog.text
    assert AUDIO_MARKER.decode() not in caplog.text
    assert TEXT_MARKER not in caplog.text


async def test_no_authorization_header_is_needed(make_client: Client) -> None:
    upstream = Upstream()
    async with make_client(voice_settings(), upstream) as api:
        heard = await api.post(TRANSCRIBE, content=AUDIO, headers={"content-type": "audio/webm"})
        spoken = await api.post(SPEAK, json={"text": "Hello"})
        # A junk token is ignored, never 401.
        junk = await api.post(
            SPEAK, json={"text": "Hello"}, headers={"authorization": "Bearer not-a-jwt"}
        )

    assert (heard.status_code, spoken.status_code, junk.status_code) == (200, 200, 200)


async def test_voice_settings_treat_blanks_as_unset() -> None:
    settings = Settings(
        voice_stt_model=" ",
        voice_tts_model="",
        voice_tts_voice="",
        voice_tts_instructions="  ",
    )

    assert settings.voice_stt_model is None
    assert settings.voice_tts_model is None
    assert settings.voice_tts_voice is None
    assert settings.voice_tts_instructions is None
    assert Settings.model_fields["voice_rate_limit_per_minute"].default == 20
