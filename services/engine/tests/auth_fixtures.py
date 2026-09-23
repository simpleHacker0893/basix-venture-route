"""Test JWKS and JWT signing for the Clerk seam (D-03, D-19).

A fresh RSA key pair per session, published as a JWKS the engine's cache is preloaded with, and a
signer that mints session tokens shaped like Clerk's: `sub`, `iss`, `exp`, `nbf`, `iat` and the
`metadata` claim the Operator adds to the session template
(`{"metadata": "{{user.public_metadata}}"}`). No network, no Clerk instance.
"""

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

TEST_JWKS_URL = "https://test-instance.clerk.accounts.dev/.well-known/jwks.json"
TEST_ISSUER = "https://test-instance.clerk.accounts.dev"
# A Svix-style webhook secret: `whsec_` + base64 of 32 random-looking bytes. Test-only value.
TEST_WEBHOOK_SECRET = "whsec_" + base64.b64encode(b"venture-route-test-webhook-key!!").decode()


@dataclass(frozen=True)
class SigningKeys:
    private_key: rsa.RSAPrivateKey
    kid: str
    jwks: dict[str, Any]


def generate_test_keys(kid: str = "test-key-1") -> SigningKeys:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk.update({"kid": kid, "use": "sig", "alg": "RS256"})
    return SigningKeys(private_key=private_key, kid=kid, jwks={"keys": [public_jwk]})


def sign_jwt(
    keys: SigningKeys,
    *,
    sub: str,
    role: str | None,
    issuer: str = TEST_ISSUER,
    expires_in: timedelta = timedelta(hours=1),
    kid: str | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": sub,
        "iss": issuer,
        "iat": now,
        "nbf": now - timedelta(seconds=5),
        "exp": now + expires_in,
        "metadata": {"role": role} if role is not None else {},
    }
    return jwt.encode(
        payload,
        keys.private_key,
        algorithm="RS256",
        headers={"kid": kid or keys.kid},
    )


def svix_headers(
    body: bytes,
    *,
    secret: str = TEST_WEBHOOK_SECRET,
    msg_id: str = "msg_test_1",
    timestamp: int | None = None,
) -> dict[str, str]:
    """Sign `body` the way Svix (and therefore Clerk) does: HMAC-SHA256 over `id.ts.body` with
    the base64-decoded secret, sent as `v1,<base64 signature>`."""
    ts = str(timestamp if timestamp is not None else int(time.time()))
    key = base64.b64decode(secret.removeprefix("whsec_"))
    digest = hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    return {
        "svix-id": msg_id,
        "svix-timestamp": ts,
        "svix-signature": "v1," + base64.b64encode(digest).decode(),
        "content-type": "application/json",
    }


def clerk_user_event(
    event_type: str,
    *,
    clerk_id: str,
    email: str,
    role: str | None = None,
) -> bytes:
    """The parts of a Clerk `user.*` webhook payload the engine reads, as canonical bytes."""
    data: dict[str, Any] = {
        "id": clerk_id,
        "primary_email_address_id": "idn_primary",
        "email_addresses": [
            {"id": "idn_other", "email_address": f"other-{email}"},
            {"id": "idn_primary", "email_address": email},
        ],
        "public_metadata": {"role": role} if role else {},
    }
    return json.dumps({"type": event_type, "data": data, "object": "event"}).encode()
