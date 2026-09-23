"""Composition root. `create_app` builds the FastAPI app; the engine, the store and the Clerk
key cache are created in the lifespan and shared via app.state. Tests call `create_app` with
overrides (a shared engine, a preloaded JWKS cache, a session factory bound to a rolled-back
connection) so nothing is patched (D-19). `app` at module level is what uvicorn serves.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.api.admin import router as admin_router
from app.api.conversation import router as conversation_router
from app.api.health import router as health_router
from app.api.internal import router as internal_router
from app.api.me import router as me_router
from app.api.route import router as route_router
from app.auth.clerk import JwksCache, fetch_jwks_over_http
from app.config import Settings, get_settings
from app.db.session import SessionFactory, create_session_factory, create_store_engine
from app.engine.errors import EngineError
from app.engine.metta_engine import MettaRouteEngine
from app.llm.factory import select_adapter
from app.models.brief import load_seed_briefs
from app.models.chat import ValidationErrorResponse
from app.models.validation import errors_message, validation_message
from app.routing.route_service import RouteService

_UNSET = object()


def create_app(
    settings: Settings | None = None,
    *,
    engine: MettaRouteEngine | None = None,
    jwks_cache: JwksCache | None = None,
    session_factory: SessionFactory | None | object = _UNSET,
) -> FastAPI:
    resolved = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        route_engine = engine or MettaRouteEngine(resolved)
        app.state.engine = route_engine
        app.state.seed_briefs = {
            brief.id: brief for brief in load_seed_briefs(resolved.seed_dir / "briefs.json")
        }
        app.state.route_service = RouteService(route_engine)
        app.state.known_entities = route_engine.known_entities()
        app.state.llm_adapter = select_adapter(resolved)

        # Clerk (D-03): keys fetched once; a placeholder CLERK_JWKS_URL means an empty cache and
        # every gated route answers 401 (D-26).
        cache = jwks_cache
        if cache is None:
            url = resolved.clerk_jwks_url
            cache = JwksCache(fetch_jwks_over_http(url) if url else None)
            await cache.refresh()
        app.state.jwks_cache = cache
        app.state.clerk_issuer = resolved.clerk_issuer

        # Marketplace store (D-17). A placeholder DATABASE_URL means no store: routing runs from
        # seed only and every marketplace route answers 503 through get_session (D-26).
        store_engine = None
        if session_factory is _UNSET:
            store_engine = (
                create_store_engine(resolved.database_url) if resolved.database_url else None
            )
            app.state.session_factory = (
                create_session_factory(store_engine) if store_engine else None
            )
        else:
            app.state.session_factory = session_factory
        app.state.store_engine = store_engine
        try:
            yield
        finally:
            if store_engine is not None:
                await store_engine.dispose()

    app = FastAPI(title="Venture Route engine", version="0.0.1", lifespan=lifespan)
    # D-30: the browser calls the engine across origins. Allow-list from CORS_ORIGINS; Sprint 003
    # turns credentials on and allows the Clerk bearer header and PUT.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.cors_origin_list,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["content-type", "authorization"],
        allow_credentials=True,
    )
    app.include_router(health_router)
    app.include_router(internal_router)
    app.include_router(route_router)
    app.include_router(conversation_router)
    app.include_router(me_router)
    app.include_router(admin_router)

    @app.exception_handler(EngineError)
    async def engine_error_handler(_: Request, exc: EngineError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": f"engine error: {exc}"})

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        """Malformed or invalid input answers `type: validation-error` with field-specific text."""
        body = ValidationErrorResponse(
            type="validation-error", message=errors_message(exc.errors())
        )
        return JSONResponse(status_code=422, content=body.model_dump(by_alias=True))

    @app.exception_handler(ValidationError)
    async def validation_error_handler(_: Request, exc: ValidationError) -> JSONResponse:
        body = ValidationErrorResponse(type="validation-error", message=validation_message(exc))
        return JSONResponse(status_code=422, content=body.model_dump(by_alias=True))

    return app


app = create_app()
