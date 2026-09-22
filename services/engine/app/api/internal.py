"""Dev-only introspection endpoint. Exists only when ENGINE_DEV_QUERY=1 (requirements.md item 5)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import get_engine, get_seed_briefs
from app.config import Settings, get_settings
from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.models.engine import EligibleTuple, Gap, PartnerCandidate, ReuseCandidate

router = APIRouter(prefix="/internal", tags=["internal"])


class QueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    brief_id: str = Field(alias="briefId", pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")


class QueryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    brief_id: str = Field(alias="briefId")
    eligible: list[EligibleTuple]
    reuse: list[ReuseCandidate]
    partners: list[PartnerCandidate]
    gaps: list[Gap]


def require_dev_query(settings: Annotated[Settings, Depends(get_settings)]) -> None:
    if not settings.engine_dev_query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


@router.post(
    "/query",
    response_model=QueryResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_dev_query)],
)
def query(
    payload: QueryRequest,
    engine: Annotated[MettaRouteEngine, Depends(get_engine)],
    briefs: Annotated[dict[str, VentureBrief], Depends(get_seed_briefs)],
) -> QueryResponse:
    brief = briefs.get(payload.brief_id)
    if brief is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"unknown seed brief {payload.brief_id}",
        )
    eligible = engine.eligible_builders(brief)
    builder_ids = sorted({t.builder_id for t in eligible})
    return QueryResponse(
        brief_id=brief.id,
        eligible=eligible,
        reuse=engine.reuse_candidates(brief),
        partners=engine.partner_candidates(brief, builder_ids),
        gaps=engine.gaps(brief),
    )
