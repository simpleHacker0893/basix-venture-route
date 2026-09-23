"""Clerk webhook ingress (D-03, spec #35 §Clerk webhook).

- `verify_svix`: the Svix signature scheme Clerk uses, standard library only. HMAC-SHA256 over
  `id.timestamp.body` with the base64 secret after `whsec_`, constant-time compare against every
  `v1,` entry, five minutes of timestamp tolerance. Any failure is one `WebhookError` → 400.
- `upsert_clerk_user`: `user.created` / `user.updated` → one users row keyed on clerk_id. A
  replayed event is a no-op. An email in ADMIN_EMAILS (case-insensitive) becomes admin and
  confirmed, and the role is written back to Clerk through `ClerkAdmin`. Admin is never taken
  from the payload: a user cannot promote themselves through public_metadata.
- `ClerkAdmin`: the one Clerk Backend API call the engine makes (publicMetadata.role). The HTTP
  implementation uses CLERK_SECRET_KEY; tests inject a fake through create_app (D-19).
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import logging
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import Settings
from app.marketplace.models import USER_ROLES, User

logger = logging.getLogger(__name__)

INVALID_SIGNATURE = "invalid webhook signature"
TIMESTAMP_TOLERANCE_SECONDS = 5 * 60
HANDLED_EVENTS = frozenset({"user.created", "user.updated"})
CLERK_API = "https://api.clerk.com/v1"


class WebhookError(Exception):
    """Any reason a webhook call is not acceptable. The reason stays server-side."""


def verify_svix(
    headers: Mapping[str, str],
    body: bytes,
    secret: str | None,
    now: float | None = None,
) -> None:
    if not secret:
        raise WebhookError("webhook secret not configured")
    msg_id = headers.get("svix-id")
    timestamp = headers.get("svix-timestamp")
    signatures = headers.get("svix-signature")
    if not msg_id or not timestamp or not signatures:
        raise WebhookError("missing svix headers")
    try:
        sent_at = int(timestamp)
    except ValueError as exc:
        raise WebhookError("bad timestamp") from exc
    current = time.time() if now is None else now
    if abs(current - sent_at) > TIMESTAMP_TOLERANCE_SECONDS:
        raise WebhookError("timestamp outside tolerance")
    try:
        key = base64.b64decode(secret.removeprefix("whsec_"), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise WebhookError("bad secret") from exc
    expected = hmac.new(key, f"{msg_id}.{timestamp}.".encode() + body, hashlib.sha256).digest()
    for entry in signatures.split():
        version, _, encoded = entry.partition(",")
        if version != "v1":
            continue
        try:
            candidate = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            continue
        if hmac.compare_digest(candidate, expected):
            return
    raise WebhookError("no matching signature")


class ClerkAdmin(Protocol):
    async def set_role(self, clerk_id: str, role: str) -> None: ...


class HttpClerkAdmin:
    """Clerk Backend API: PATCH /users/{id}/metadata with the server-side secret key."""

    def __init__(self, secret_key: str, base_url: str = CLERK_API) -> None:
        self._secret_key = secret_key
        self._base_url = base_url

    async def set_role(self, clerk_id: str, role: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                f"{self._base_url}/users/{clerk_id}/metadata",
                headers={"Authorization": f"Bearer {self._secret_key}"},
                json={"public_metadata": {"role": role}},
            )
            response.raise_for_status()


class NullClerkAdmin:
    """Placeholder CLERK_SECRET_KEY (D-26): the local row is updated, Clerk is not called."""

    async def set_role(self, clerk_id: str, role: str) -> None:
        return None


@dataclass(frozen=True)
class ClerkUserEvent:
    event_type: str
    clerk_id: str
    email: str
    claimed_role: str | None


def parse_user_event(payload: Any) -> ClerkUserEvent | None:
    """The fields the engine reads from a Clerk `user.*` event; None for other event types."""
    if not isinstance(payload, dict):
        raise WebhookError("payload is not an object")
    event_type = payload.get("type")
    if event_type not in HANDLED_EVENTS:
        return None
    data = payload.get("data")
    if not isinstance(data, dict):
        raise WebhookError("event has no data")
    clerk_id = data.get("id")
    if not isinstance(clerk_id, str) or not clerk_id:
        raise WebhookError("event has no user id")
    email = _primary_email(data)
    if email is None:
        raise WebhookError("event has no primary email")
    metadata = data.get("public_metadata")
    claimed = metadata.get("role") if isinstance(metadata, dict) else None
    return ClerkUserEvent(
        event_type=str(event_type),
        clerk_id=clerk_id,
        email=email,
        claimed_role=claimed if claimed in USER_ROLES else None,
    )


def _primary_email(data: dict[str, Any]) -> str | None:
    addresses = data.get("email_addresses")
    if not isinstance(addresses, list) or not addresses:
        return None
    primary_id = data.get("primary_email_address_id")
    for entry in addresses:
        if isinstance(entry, dict) and entry.get("id") == primary_id:
            email = entry.get("email_address")
            return email if isinstance(email, str) else None
    first = addresses[0]
    email = first.get("email_address") if isinstance(first, dict) else None
    return email if isinstance(email, str) else None


async def upsert_clerk_user(
    session: AsyncSession,
    settings: Settings,
    clerk_admin: ClerkAdmin,
    event: ClerkUserEvent,
) -> User:
    """Insert on first sight, update email and role afterwards; identical input is a no-op.

    Admin comes only from ADMIN_EMAILS. Any other role in the payload is kept as sent, except
    `admin`, which is ignored so nobody can promote themselves."""
    is_admin = event.email.strip().lower() in settings.admin_email_list
    role = "admin" if is_admin else (event.claimed_role if event.claimed_role != "admin" else None)
    user = (await session.exec(select(User).where(User.clerk_id == event.clerk_id))).first()
    if user is None:
        user = User(clerk_id=event.clerk_id, email=event.email, role=role)
        session.add(user)
    else:
        user.email = event.email
        if role is not None:
            user.role = role
    if is_admin:
        user.role = "admin"
        user.status = "confirmed"
    await session.commit()
    if is_admin:
        # The row is committed; a Clerk Backend API failure must not turn the webhook into a
        # 500 after the fact. Clerk retries the event, and the replay writes the role again.
        try:
            await clerk_admin.set_role(event.clerk_id, "admin")
        except Exception:
            logger.warning(
                "admin role write to Clerk failed for %s; the replay will retry", event.clerk_id
            )
    return user
