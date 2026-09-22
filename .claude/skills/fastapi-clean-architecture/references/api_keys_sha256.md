# API keys con SHA-256

Para clientes machine-to-machine, integraciones externas o servicios internos, una API key puede coexistir con Clerk JWT. Si gestionás las keys vos mismo, guardalas como hash, no en texto plano.

Fuentes: [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [Supabase API keys best practices](https://supabase.com/docs/guides/getting-started/api-keys)

## Diseño recomendado

Documento de persistencia (Mongo) o tabla (SQL):

```text
api_keys:
  _id              -> id interno
  prefix           -> primeros chars no-secretos para lookup/display (ej. "sk_abcd12")
  key_hash         -> SHA-256 (o HMAC-SHA-256 con pepper) de la key completa
  subject_id       -> owner: user_id / organization_id / service_id
  subject_type     -> "user" | "organization" | "service"
  scopes           -> lista de permisos
  name             -> nombre humano (ej. "Production webhook")
  created_at
  expires_at       -> nullable
  revoked_at       -> nullable
  last_used_at
  created_by
```

Reglas:

```text
[ ] Nunca guardar la API key en texto plano.
[ ] Mostrar la key completa SOLO una vez al crearla.
[ ] Loguear solo prefix / key_id, nunca la key completa.
```

## Generación segura

Python recomienda el módulo `secrets` para tokens criptográficos.

```python
# app/modules/auth/infrastructure/api_key_crypto.py
import hashlib
import hmac
import secrets


def generate_api_key(prefix: str = "sk") -> str:
    # 32 bytes ~= 256 bits de entropía antes de codificación.
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def hash_api_key(raw_key: str, pepper: bytes | None = None) -> str:
    """SHA-256 simple, o HMAC-SHA-256 si se provee pepper del servidor."""
    key_bytes = raw_key.encode("utf-8")
    if pepper:
        return hmac.new(pepper, key_bytes, hashlib.sha256).hexdigest()
    return hashlib.sha256(key_bytes).hexdigest()


def verify_api_key(raw_key: str, stored_hash: str, pepper: bytes | None = None) -> bool:
    """Comparación segura contra timing attacks."""
    candidate = hash_api_key(raw_key, pepper=pepper)
    return hmac.compare_digest(candidate, stored_hash)
```

Notas:

- Usá `secrets.token_urlsafe(32)`, no `random` ni `uuid4()`.
- Comparar con `hmac.compare_digest`, **nunca** con `==` (timing attack).
- Si querés que una filtración de DB no permita comprobar keys, usá HMAC-SHA-256 con un `pepper` secreto del servidor (env var, no en DB).

Fuentes: [Python docs - secrets](https://docs.python.org/3/library/secrets.html), [Python docs - hmac.compare_digest](https://docs.python.org/3/library/hmac.html), [NIST - Hash Functions Policy](https://csrc.nist.gov/projects/hash-functions/nist-policy-on-hash-functions)

## Verificación como dependencia FastAPI

```python
# app/api/auth/api_key_auth.py
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status

from app.modules.auth.application.principal import AuthenticatedPrincipal
from app.modules.auth.infrastructure.api_key_crypto import verify_api_key, hash_api_key
from app.modules.auth.domain.ports import ApiKeyRepository


async def get_service_principal(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    repo: ApiKeyRepository = Depends(get_api_key_repository),
) -> AuthenticatedPrincipal:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    # Lookup por hash directamente (índice único). El prefix es solo para UI.
    key_hash = hash_api_key(x_api_key, pepper=settings.api_key_pepper_bytes)
    record = await repo.get_active_by_hash(key_hash)

    now = datetime.now(timezone.utc)
    if record is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if record.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Revoked API key")
    if record.expires_at and record.expires_at <= now:
        raise HTTPException(status_code=401, detail="Expired API key")

    await repo.mark_used(record.id, used_at=now)

    return AuthenticatedPrincipal(
        subject_id=record.subject_id,
        auth_type="api_key",
        session_id=None,
        organization_id=record.organization_id,
        scopes=frozenset(record.scopes),
    )
```

## Índice único en `key_hash`

Garantía de infraestructura:

```python
await db.api_keys.create_index("key_hash", unique=True)
await db.api_keys.create_index("prefix")  # para búsquedas en UI
```

## No aceptar ambigüedad silenciosa

Si una ruta acepta Clerk JWT y API key, declaralo explícitamente. Si llegan ambos a la vez, una política segura es rechazar o definir precedencia documentada.

```text
Endpoint de usuario humano        -> solo Clerk JWT
Endpoint de integración externa   -> solo API key
Endpoint mixto                    -> declarar allowed_auth_modes=["clerk_jwt", "api_key"]
```

## Checklist API key SHA-256

```text
[ ] Generación con secrets.token_urlsafe (alta entropía).
[ ] Guardar SOLO SHA-256 hash (o HMAC-SHA-256 con pepper).
[ ] Índice único sobre key_hash.
[ ] Mostrar la key completa SOLO una vez al crearla.
[ ] Logs nunca contienen la key completa (solo prefix/id).
[ ] Cada key tiene owner, scopes, estado (active/revoked) y expiration opcional.
[ ] Flujo de revocación y rotación documentado.
[ ] Comparar hashes con hmac.compare_digest, nunca ==.
[ ] HTTPS siempre.
[ ] Rate limit por key/owner.
[ ] No mezclar API keys con sesiones de Clerk sin una regla explícita.
```

## Fuentes

- [Python docs - secrets](https://docs.python.org/3/library/secrets.html)
- [Python docs - hmac.compare_digest](https://docs.python.org/3/library/hmac.html)
- [NIST - Policy on Hash Functions](https://csrc.nist.gov/projects/hash-functions/nist-policy-on-hash-functions)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Supabase - API keys best practices](https://supabase.com/docs/guides/getting-started/api-keys)
- [Clerk - Using API keys](https://clerk.com/docs/guides/development/machine-auth/api-keys)
