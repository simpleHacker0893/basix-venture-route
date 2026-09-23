"""Builder routes under /api/me/* (spec #35 §Marketplace API). Router-level guard: builder.

Tracer stub from #38; #40 gives the profile its body and adds the role endpoint.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth.clerk import CurrentUser, require_role

router = APIRouter(prefix="/api/me", dependencies=[Depends(require_role("builder"))])


@router.get("/profile")
async def get_profile(
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
) -> dict[str, str]:
    raise HTTPException(status_code=404, detail="no profile yet")
