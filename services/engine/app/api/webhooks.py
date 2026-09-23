"""POST /api/webhooks/clerk (D-03, spec #35 §Clerk webhook). Outside the auth guards: Clerk calls
it server to server and the Svix signature is the authentication."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.webhook import (
    INVALID_SIGNATURE,
    ClerkAdmin,
    WebhookError,
    parse_user_event,
    upsert_clerk_user,
    verify_svix,
)
from app.config import Settings
from app.db.session import get_session

router = APIRouter(prefix="/api/webhooks")


class WebhookResponse(BaseModel):
    handled: bool
    clerk_id: str | None = None
    role: str | None = None
    confirmed: bool | None = None


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _clerk_admin(request: Request) -> ClerkAdmin:
    admin: ClerkAdmin = request.app.state.clerk_admin
    return admin


@router.post("/clerk", response_model=WebhookResponse, response_model_exclude_none=True)
async def clerk_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(_settings)],
    clerk_admin: Annotated[ClerkAdmin, Depends(_clerk_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WebhookResponse:
    body = await request.body()  # the signature covers the exact bytes, so read before parsing
    try:
        verify_svix(request.headers, body, settings.clerk_webhook_signing_secret)
        event = parse_user_event(json.loads(body))
    except (WebhookError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=INVALID_SIGNATURE) from exc
    if event is None:
        return WebhookResponse(handled=False)
    user = await upsert_clerk_user(session, settings, clerk_admin, event)
    return WebhookResponse(
        handled=True,
        clerk_id=user.clerk_id,
        role=user.role,
        confirmed=user.status == "confirmed",
    )
