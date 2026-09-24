"""Graph projection (D-15, spec #35 §Projection): confirmed marketplace rows → seed-shaped facts.

`reproject(engine, session)` loads every confirmed builder through the repository, renders one
MeTTa program in exactly the predicates `seed/facts.metta` uses, and swaps the engine's space for
a fresh runtime holding the seed files plus that program. Full rebuild, never incremental. Only
builders whose account is confirmed produce atoms; founders and admins never do. The admin
symbol is the seed's `admin-basix`; the confirmations table records which admin acted.

Sprint 005a (D-52) adds four display-only predicates that no rule reads: `(showcases b p)` for a
publicly visible Showcase entry, `(has-skill-set b "<label>")`, `(suggested-skill b "<label>")`
and `(certified b cred "<issuer>")` for a confirmed credential with no vocabulary skill. Free
text only ever enters the program through `metta_string`, as exactly one string atom.
"""

from __future__ import annotations

import asyncio
import unicodedata

from fastapi.concurrency import run_in_threadpool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.metta_engine import MettaRouteEngine
from app.marketplace import repo
from app.marketplace.verification import ConfirmedBuilder

ADMIN_SYMBOL = "admin-basix"
SHORT_ID = 8


def short(row_id: str) -> str:
    return row_id.replace("-", "")[:SHORT_ID]


_ESCAPES = {"\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t"}
# Other control, format and line/paragraph separator characters are written as `\u{hex}` so the
# atom stays on one printable line. NUL aborts the native runtime and a lone surrogate cannot
# cross into it at all, so both become U+FFFD.
_HEX_ESCAPED = frozenset({"Cc", "Cf", "Zl", "Zp"})
_REPLACEMENT = "\ufffd"


def metta_string(text: str) -> str:
    """Any free text as exactly one quoted MeTTa string atom on one line (spec #86 Testing 6)."""
    out: list[str] = []
    for char in text:
        category = unicodedata.category(char)
        if char in _ESCAPES:
            out.append(_ESCAPES[char])
        elif char == "\x00" or category == "Cs":
            out.append(_REPLACEMENT)
        elif category in _HEX_ESCAPED:
            out.append(f"\\u{{{ord(char):x}}}")
        else:
            out.append(char)
    return '"' + "".join(out) + '"'


def render_program(builders: list[ConfirmedBuilder]) -> list[str]:
    """One fact per line: the seed predicates plus the four display-only ones (D-52). No new rule
    name, and no rule reads a display predicate, so they never change a route."""
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
        lines.extend(
            f"(has-skill-set {b.builder_id} {metta_string(label)})" for label in b.skill_set
        )
        lines.extend(
            f"(suggested-skill {b.builder_id} {metta_string(label)})"
            for label in b.suggested_skills
        )
        for credential in b.rows.credentials:
            cred = f"cred-{short(credential.credential_id)}"
            lines.append(f"(earned {b.builder_id} {cred})")
            lines.append(f"(proves {cred} {credential.skill_id})")
            lines.append(f"(confirmed {ADMIN_SYMBOL} {cred})")
        for certification in b.rows.certifications:
            # A skill-less certification never earns or proves anything: display only (D-52).
            cert = f"cred-{short(certification.credential_id)}"
            issuer = metta_string(certification.issuer)
            lines.append(f"(certified {b.builder_id} {cert} {issuer})")
        for project in b.rows.projects:
            proj = f"proj-{short(project.project_id)}"
            lines.append(f"(built {b.builder_id} {proj})")
            lines.extend(f"(demonstrates {proj} {skill})" for skill in project.skill_ids)
            lines.append(f"(confirmed {ADMIN_SYMBOL} {proj})")
            if project.showcased:
                lines.append(f"(showcases {b.builder_id} {proj})")
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
