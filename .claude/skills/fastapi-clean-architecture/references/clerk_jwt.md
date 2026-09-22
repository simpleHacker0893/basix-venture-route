# Auth con Clerk JWT RS256

Clerk emite session tokens JWT firmados con la private key de la instancia, verificables con su public key. Los tokens llegan al backend por cookie `__session` (same-origin) o header `Authorization` (cross-origin).

Fuente: [Clerk - Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)

## Regla de arquitectura

```text
Verificación JWT          = API/security layer
Principal autenticado     = Application boundary
Reglas de autorización    = Application/domain
```

El dominio no conoce Clerk, JWT, JWKS, RS256, cookies ni HTTP headers.

## Validaciones obligatorias

```text
[ ] Algoritmo: RS256.
[ ] Firma con public key/JWKS de la instancia de Clerk.
[ ] exp: token no expirado.
[ ] nbf: token ya válido.
[ ] azp / authorizedParties: origen permitido.
[ ] aud: si usás JWT templates con audiencia custom.
[ ] sub: extraído como user_id externo de Clerk.
[ ] JWKS cacheado, refrescar ante kid desconocido.
```

Fuentes: [Clerk - Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [Clerk - Tokens and signatures](https://clerk.com/docs/guides/how-clerk-works/tokens-and-signatures)

## JWKS / public key

Tres formas de obtener la public key:

```text
1. Backend API JWKS:        https://api.clerk.com/v1/jwks
2. Frontend API URL:        <frontend-api>/.well-known/jwks.json
3. JWKS Public Key:         desde Clerk Dashboard
```

Recomendación:

```text
Local/dev:      PEM public key desde environment variable.
Producción:     JWKS con cache + rotación automática.
```

## Principal unificado para la aplicación

Después de verificar Clerk, convertí el token a un objeto interno simple:

```python
# app/modules/auth/application/principal.py
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    subject_id: str
    auth_type: Literal["clerk_jwt", "api_key"]
    session_id: str | None
    organization_id: str | None
    scopes: frozenset[str]
```

Los casos de uso reciben `AuthenticatedPrincipal`, **no** `Request`, **no** `HTTPAuthorizationCredentials`, **no** `ClerkClient`.

```python
class CreateProjectUseCase:
    async def execute(self, principal: AuthenticatedPrincipal, command: CreateProjectCommand):
        if "project:create" not in principal.scopes:
            raise PermissionDenied()
        ...
```

## Dependencia FastAPI (Clerk)

```python
# app/api/auth/clerk_auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.modules.auth.application.principal import AuthenticatedPrincipal
from app.modules.auth.infrastructure.clerk_jwt import ClerkJWTVerifier, InvalidToken

bearer_scheme = HTTPBearer(auto_error=False)


async def get_user_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    verifier: ClerkJWTVerifier = Depends(get_clerk_jwt_verifier),
) -> AuthenticatedPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        claims = await verifier.verify(credentials.credentials)
    except InvalidToken:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    return AuthenticatedPrincipal(
        subject_id=claims["sub"],
        auth_type="clerk_jwt",
        session_id=claims.get("sid"),
        organization_id=claims.get("org_id"),
        scopes=frozenset(extract_scopes(claims)),
    )
```

Regla:

```text
La dependency de FastAPI puede lanzar HTTPException.
El verifier de infrastructure valida Clerk/JWKS.
Los use cases reciben AuthenticatedPrincipal, no JWT crudo.
```

## Verifier de infraestructura (esqueleto)

```python
# app/modules/auth/infrastructure/clerk_jwt.py
import httpx
import jwt
from jwt import PyJWKClient


class InvalidToken(Exception):
    pass


class ClerkJWTVerifier:
    def __init__(self, jwks_url: str, authorized_parties: list[str]):
        self._jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
        self._authorized_parties = set(authorized_parties)

    async def verify(self, token: str) -> dict:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                options={"require": ["exp", "nbf", "sub"]},
            )
        except jwt.InvalidTokenError as e:
            raise InvalidToken(str(e))

        azp = claims.get("azp")
        if self._authorized_parties and azp not in self._authorized_parties:
            raise InvalidToken(f"Unauthorized party: {azp}")

        return claims
```

## Autorización es distinta de autenticación

```text
Autenticación: "¿quién llama?"  -> verifier devuelve Principal
Autorización:  "¿puede hacer esto?" -> regla de negocio en use case / domain service
```

```python
class PublishArticleUseCase:
    async def execute(self, command: PublishArticleCommand, principal: AuthenticatedPrincipal):
        if "articles:publish" not in principal.scopes:
            raise PermissionDenied("Missing scope: articles:publish")

        article = await self.article_repo.get(command.article_id)
        if article.author_id != principal.subject_id:
            raise PermissionDenied("Cannot publish someone else's article")

        article.publish()
        await self.article_repo.save(article)
```

La autorización de **negocio** ("un usuario no puede publicar el artículo de otro usuario") vive en application/domain. La autenticación y el chequeo de scopes/permisos genéricos por ruta pueden vivir en la dependencia FastAPI.

## Checklist Clerk JWT

```text
[ ] Se valida RS256 + firma con JWKS/public key.
[ ] Se valida exp y nbf.
[ ] Se valida azp contra authorized parties cuando aplique.
[ ] Se valida aud/issuer si la configuración lo requiere.
[ ] JWKS cacheado con refresh ante kid desconocido.
[ ] El use case recibe AuthenticatedPrincipal, no JWT crudo.
[ ] Los routers NO decodifican JWT manualmente.
[ ] El dominio NO importa Clerk, JWT, ni nada HTTP.
```

## Fuentes

- [Clerk - Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Clerk - Tokens and signatures](https://clerk.com/docs/guides/how-clerk-works/tokens-and-signatures)
- [Clerk - Session tokens](https://clerk.com/docs/guides/sessions/session-tokens)
- [FastAPI - Security Dependencies](https://fastapi.tiangolo.com/reference/dependencies/)
