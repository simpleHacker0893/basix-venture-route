"""POST /api/conversation: the chat seam (PRD §5.2; Sprint 001, #16).

One founder turn in, exactly one of clarification / route / validation-error out. The adapter
is selected once in the lifespan from `LLM_PROVIDER` and `ANTHROPIC_API_KEY` (NullAdapter when
unset); the route service is the same singleton `POST /api/route` uses.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_route_service
from app.conversation.orchestrator import Orchestrator
from app.llm.base import LlmAdapter
from app.models.chat import ChatResponse, ChatTurn
from app.routing.route_service import RouteService

router = APIRouter(prefix="/api", tags=["routing"])


def get_orchestrator(
    request: Request,
    service: Annotated[RouteService, Depends(get_route_service)],
) -> Orchestrator:
    adapter: LlmAdapter = request.app.state.llm_adapter
    known: frozenset[str] = request.app.state.known_entities
    return Orchestrator(adapter, service.route, known)


@router.post("/conversation", response_model=ChatResponse, response_model_by_alias=True)
def conversation(
    turn: ChatTurn,
    orchestrator: Annotated[Orchestrator, Depends(get_orchestrator)],
) -> ChatResponse:
    return orchestrator.handle(turn)
