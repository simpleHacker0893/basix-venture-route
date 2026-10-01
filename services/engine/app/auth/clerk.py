"""Clerk session verification and role gating (D-03, spec #35 §Authentication).

- `JwksCache`: Clerk's public keys, fetched once at start-up, refetched once on an unknown `kid`.
  Tests preload it from a generated key pair; a placeholder CLERK_JWKS_URL leaves it empty.
- `verify_session_jwt`: RS256, `exp`, `nbf` (30 s leeway), `iss` = the JWKS URL origin. No
  audience. Every failure is one `AuthError`, mapped to 401 `{"detail": "invalid session"}` by
  the composition root; the body never says why, and nothing here can reach the 500 handler.
- `current_user`: the bearer token → `CurrentUser(clerk_id, role, db_user)`. `role` comes from the
  `metadata` claim the Operator adds to Clerk's session template; the users row may not exist yet
  (webhook not arrived); with no role claim, only `POST /api/me/role` accepts that state.
- `require_role(...)`: 403 `{"detail": "role <r> required"}`; applied at router level. An allowed
  claim role without a users row creates the row from the claim (D-56).
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated, Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWK
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_session
from app.marketplace.models import USER_ROLES, User

INVALID_SESSION = "invalid session"
# A row made before the webhook arrives; the webhook overwrites the email when it does.
PENDING_EMAIL_DOMAIN = "pending.clerk.invalid"
# The roles a user picks for themselves. Admin comes only from ADMIN_EMAILS via the webhook.
SELF_CHOSEN_ROLES = ("builder", "founder")
LEEWAY_SECONDS = 30
JWKS_TIMEOUT_SECONDS = 5.0
# A miss refetches the JWKS at most this often, so a stream of tokens with bogus key ids
# cannot turn the engine into a fetch amplifier against Clerk.
JWKS_REFETCH_INTERVAL_SECONDS = 60.0

Fetch = Callable[[], Awaitable[dict[str, Any]]]


class AuthError(Exception):
    """Any reason a session token is not acceptable. The reason stays server-side."""


def fetch_jwks_over_http(url: str) -> Fetch:
    async def _fetch() -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=JWKS_TIMEOUT_SECONDS) as client:
            response = await client.get(url)
            response.raise_for_status()
            body: dict[str, Any] = response.json()
            return body

    return _fetch


class JwksCache:
    """Public keys by `kid`. One fetch at start-up, a rate-limited refetch on a miss, never on a
    schedule."""

    def __init__(self, fetch: Fetch | None) -> None:
        self._fetch = fetch
        self._keys: dict[str, PyJWK] = {}
        self._lock = asyncio.Lock()
        self._last_miss_refetch = float("-inf")

    @classmethod
    def preloaded(cls, jwks: dict[str, Any]) -> JwksCache:
        cache = cls(fetch=None)
        cache._load(jwks)
        return cache

    @classmethod
    def empty(cls) -> JwksCache:
        return cls(fetch=None)

    @property
    def size(self) -> int:
        return len(self._keys)

    def _load(self, jwks: dict[str, Any]) -> None:
        keys: dict[str, PyJWK] = {}
        for entry in jwks.get("keys", []):
            kid = entry.get("kid")
            if isinstance(kid, str):
                keys[kid] = PyJWK.from_dict(entry)
        self._keys = keys

    async def refresh(self) -> bool:
        """Fetch the JWKS; False when there is nothing to fetch or the fetch failed."""
        if self._fetch is None:
            return False
        try:
            self._load(await self._fetch())
        except Exception:
            return False
        return True

    async def key_for(self, kid: str) -> PyJWK:
        key = self._keys.get(kid)
        if key is not None:
            return key
        async with self._lock:
            now = time.monotonic()
            if (
                kid not in self._keys
                and now - self._last_miss_refetch >= JWKS_REFETCH_INTERVAL_SECONDS
            ):
                self._last_miss_refetch = now
                await self.refresh()
        key = self._keys.get(kid)
        if key is None:
            raise AuthError("unknown key id")
        return key


@dataclass(frozen=True)
class SessionClaims:
    clerk_id: str
    role: str | None


async def verify_session_jwt(token: str, cache: JwksCache, issuer: str | None) -> SessionClaims:
    if issuer is None:
        raise AuthError("Clerk is not configured")
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise AuthError("malformed token") from exc
    kid = header.get("kid")
    if not isinstance(kid, str):
        raise AuthError("token has no key id")
    key = await cache.key_for(kid)
    try:
        payload = jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            issuer=issuer,
            leeway=LEEWAY_SECONDS,
            options={"require": ["exp", "iss", "sub"], "verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise AuthError("token rejected") from exc
    clerk_id = payload.get("sub")
    if not isinstance(clerk_id, str) or not clerk_id:
        raise AuthError("token has no subject")
    metadata = payload.get("metadata")
    role = metadata.get("role") if isinstance(metadata, dict) else None
    return SessionClaims(clerk_id=clerk_id, role=role if role in USER_ROLES else None)


@dataclass(frozen=True)
class CurrentUser:
    clerk_id: str
    role: str | None
    db_user: User | None


def _bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise AuthError("no bearer token")
    return token.strip()


async def current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CurrentUser:
    cache: JwksCache = request.app.state.jwks_cache
    issuer: str | None = request.app.state.clerk_issuer
    try:
        claims = await verify_session_jwt(_bearer_token(request), cache, issuer)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=INVALID_SESSION) from exc
    db_user = (await session.exec(select(User).where(User.clerk_id == claims.clerk_id))).first()
    return CurrentUser(clerk_id=claims.clerk_id, role=claims.role, db_user=db_user)


async def _row_from_claim(session: AsyncSession, clerk_id: str, role: str) -> User:
    """The users row for a claim role this database has never seen (D-56): the webhook did not
    arrive, or the engine points at a fresh branch. The role is server-written Clerk
    publicMetadata, the same trust the webhook gives it. The dashboard fires its requests in
    parallel, so a racing insert is skipped and the winner's row is read back."""
    row = User(clerk_id=clerk_id, email=f"{clerk_id}@{PENDING_EMAIL_DOMAIN}", role=role)
    await session.exec(pg_insert(User).values(**row.model_dump()).on_conflict_do_nothing())
    await session.commit()
    return (await session.exec(select(User).where(User.clerk_id == clerk_id))).one()


def require_role(*roles: str) -> Callable[..., Awaitable[CurrentUser]]:
    """Dependency: a verified session whose claim role is allowed; its users row is created from
    the claim when missing (D-56)."""
    wanted = " or ".join(roles)

    async def _require(
        user: Annotated[CurrentUser, Depends(current_user)],
        session: Annotated[AsyncSession, Depends(get_session)],
    ) -> CurrentUser:
        if user.role is None or user.role not in roles:
            raise HTTPException(status_code=403, detail=f"role {wanted} required")
        if user.db_user is None:
            if user.role not in SELF_CHOSEN_ROLES:
                raise HTTPException(status_code=403, detail=f"role {wanted} required")
            db_user = await _row_from_claim(session, user.clerk_id, user.role)
            return CurrentUser(clerk_id=user.clerk_id, role=user.role, db_user=db_user)
        return user

    return _require
