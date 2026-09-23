"""Graph projection (D-15, spec #35 §Projection): confirmed marketplace rows → seed-shaped facts.

`reproject(engine, session)` loads every confirmed builder through the repository, renders one
MeTTa program in exactly the predicates `seed/facts.metta` uses, and swaps the engine's space for
a fresh runtime holding the seed files plus that program. Full rebuild, never incremental. Only
builders whose account is confirmed produce atoms; founders and admins never do. The admin
symbol is the seed's `admin-basix`; the confirmations table records which admin acted.
"""

from __future__ import annotations

import asyncio

from fastapi.concurrency import run_in_threadpool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.metta_engine import MettaRouteEngine
from app.marketplace import repo
from app.marketplace.verification import ConfirmedBuilder

ADMIN_SYMBOL = "admin-basix"
SHORT_ID = 8


def short(row_id: str) -> str:
    return row_id.replace("-", "")[:SHORT_ID]


def render_program(builders: list[ConfirmedBuilder]) -> list[str]:
    """One fact per line, seed predicates only: no new predicate and no new rule name."""
    lines: list[str] = []
    for b in builders:
        lines.append(f"(confirmed {ADMIN_SYMBOL} {b.builder_id})")
        lines.append(f"(day-rate {b.builder_id} {b.day_rate})")
        lines.append(f"(located-in {b.builder_id} {repo.slugify(b.location)})")
        lines.extend(f"(supports-mode {b.builder_id} {mode})" for mode in b.modes)
        lines.extend(
            f"(available {b.builder_id} {start.isoformat()} {end.isoformat()})"
            for start, end in b.availability
        )
        if b.cohort_id:
            lines.append(f"(belongs-to {b.builder_id} {b.cohort_id})")
        lines.extend(
            f"(has-self-described-skill {b.builder_id} {skill})" for skill in b.self_described
        )
        for credential in b.rows.credentials:
            cred = f"cred-{short(credential.credential_id)}"
            lines.append(f"(earned {b.builder_id} {cred})")
            lines.append(f"(proves {cred} {credential.skill_id})")
            lines.append(f"(confirmed {ADMIN_SYMBOL} {cred})")
        for project in b.rows.projects:
            proj = f"proj-{short(project.project_id)}"
            lines.append(f"(built {b.builder_id} {proj})")
            lines.extend(f"(demonstrates {proj} {skill})" for skill in project.skill_ids)
            lines.append(f"(confirmed {ADMIN_SYMBOL} {proj})")
            if project.licensable:
                lines.append(f"(licensable {proj})")
                lines.append(f"(vertical {proj} {project.vertical})")
    return lines


# One reprojection at a time, in arrival order: the row read and the rebuild stay together, so
# two admin decisions in flight cannot swap an older row set in after a newer one.
_REPROJECT_LOCK = asyncio.Lock()


async def reproject(engine: MettaRouteEngine, session: AsyncSession) -> int:
    """Rebuild the space from seed facts plus confirmed rows; returns the projected atom count."""
    async with _REPROJECT_LOCK:
        builders = await repo.confirmed_builders(session)
        program = render_program(builders)
        return await run_in_threadpool(engine.replace_space, "\n".join(program))
