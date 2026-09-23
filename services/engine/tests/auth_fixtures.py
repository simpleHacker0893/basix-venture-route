"""Test JWKS and JWT signing for the Clerk seam (D-03, D-19).

A fresh RSA key pair per session, published as a JWKS the engine's cache is preloaded with, and a
signer that mints session tokens shaped like Clerk's: `sub`, `iss`, `exp`, `nbf`, `iat` and the
`metadata` claim the Operator adds to the session template
(`{"metadata": "{{user.public_metadata}}"}`). No network, no Clerk instance.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

TEST_JWKS_URL = "https://test-instance.clerk.accounts.dev/.well-known/jwks.json"
TEST_ISSUER = "https://test-instance.clerk.accounts.dev"


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
