"""Admin routes under /api/admin/* (spec #35 §Marketplace API). Router-level guard: admin.

Tracer stub from #38; #42 fills the queue from the repository and adds confirm and reject.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.clerk import require_role

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_role("admin"))])


class PendingResponse(BaseModel):
    accounts: list[dict[str, object]]
    credentials: list[dict[str, object]]
    projects: list[dict[str, object]]


@router.get("/pending", response_model=PendingResponse)
async def pending() -> PendingResponse:
    return PendingResponse(accounts=[], credentials=[], projects=[])
