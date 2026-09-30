"""POST /api/me/skills/suggest: skill chips from pasted résumé text (D-50; #95).

Builder only. The text goes to the configured LlmAdapter (Claude Haiku 4.5 through `app/llm`) and
nowhere else: it is never stored, never logged and never echoed. Any adapter failure (null
adapter, missing key, timeout, provider error) answers 200 `{available: false, suggestions: []}`,
never a 5xx. Only the exception class name is logged, because a provider message may quote the
prompt.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import require_role
from app.db.session import get_session
from app.llm.base import LlmAdapter
from app.llm.skill_suggestions import to_suggestions
from app.marketplace import repo
from app.marketplace.schemas import SkillSuggestions, SkillSuggestRequest

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/me", dependencies=[Depends(require_role("builder"))])

UNAVAILABLE = SkillSuggestions(available=False, suggestions=[])


def _adapter(request: Request) -> LlmAdapter:
    adapter: LlmAdapter = request.app.state.llm_adapter
    return adapter


@router.post("/skills/suggest", response_model=SkillSuggestions)
async def suggest_skills(
    body: SkillSuggestRequest,
    adapter: Annotated[LlmAdapter, Depends(_adapter)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SkillSuggestions:
    vocabulary = await repo.skill_names(session)
    try:
        labels = await run_in_threadpool(adapter.suggest_skills, body.resume_text)
    except Exception as exc:  # never a 5xx (D-50); never log the message, it may quote the text
        log.info("skill suggestions unavailable (%s)", type(exc).__name__)
        return UNAVAILABLE
    return SkillSuggestions(available=True, suggestions=to_suggestions(labels, vocabulary))
