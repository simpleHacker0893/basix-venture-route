"""Remove the rows earlier Clerk end-to-end runs left in the local store (Sprint 004, #76).

The Clerk Playwright suite creates fresh `+clerk_test` users per run and deletes them in Clerk,
but their marketplace rows stay in the compose `db`; a builder confirmed by one run is projected
into the graph at the next engine start and the "pending builder" assertions stop holding. The
suite's engine command runs this before uvicorn, so every run starts from seed-only atoms.

Which users count as the suite's: (a) the admin, whose real address the self-signed webhook
wrote (`vr-e2e-<run>-admin+clerk_test@example.com`); (b) any user whose profile slug starts with
`e2e-builder-`; (c) any user with the placeholder address `<clerk id>@pending.clerk.invalid`
and no profile, which `POST /api/me/role` writes when no webhook has delivered the real email,
the only way a founder or builder row appears in this store. Rows of anyone else are untouched.

Usage (from services/engine, DATABASE_URL pointing at the compose db):
    uv run python scripts/e2e_reset.py            # deletes the rows
    uv run python scripts/e2e_reset.py --dry-run  # counts only
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

E2E_EMAIL_PATTERN = "vr-e2e-%+clerk_test@example.com"
PLACEHOLDER_PATTERN = "%@pending.clerk.invalid"
E2E_BUILDER_PREFIX = "e2e-builder-%"

SELECT_USERS = """
    CREATE TEMPORARY TABLE e2e_users ON COMMIT DROP AS
    SELECT u.id FROM users u
    WHERE u.email LIKE :e2e
       OR u.id IN (SELECT p.user_id FROM profiles p WHERE p.builder_id LIKE :builder)
       OR (u.email LIKE :placeholder
           AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id))
"""

PROFILES = "(SELECT p.id FROM profiles p WHERE p.user_id IN (SELECT id FROM e2e_users))"
USERS = "(SELECT id FROM e2e_users)"

# Children first; every statement is scoped to the suite's users.
STATEMENTS = [
    ("bookings", f"DELETE FROM bookings WHERE founder_id IN {USERS} OR profile_id IN {PROFILES}"),
    (
        "bids",
        f"DELETE FROM bids WHERE profile_id IN {PROFILES}"
        f" OR request_id IN (SELECT r.id FROM requests r WHERE r.founder_id IN {USERS})",
    ),
    ("requests", f"DELETE FROM requests WHERE founder_id IN {USERS}"),
    ("confirmations", f"DELETE FROM confirmations WHERE admin_user_id IN {USERS}"),
    ("availability", f"DELETE FROM availability WHERE profile_id IN {PROFILES}"),
    (
        "project_skills",
        f"DELETE FROM project_skills WHERE project_id IN"
        f" (SELECT pr.id FROM projects pr WHERE pr.profile_id IN {PROFILES})",
    ),
    ("projects", f"DELETE FROM projects WHERE profile_id IN {PROFILES}"),
    ("credentials", f"DELETE FROM credentials WHERE profile_id IN {PROFILES}"),
    ("profiles", f"DELETE FROM profiles WHERE user_id IN {USERS}"),
    ("users", f"DELETE FROM users WHERE id IN {USERS}"),
]


async def reset(url: str, dry_run: bool) -> int:
    engine = create_async_engine(url)
    total = 0
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text(SELECT_USERS),
                {
                    "e2e": E2E_EMAIL_PATTERN,
                    "builder": E2E_BUILDER_PREFIX,
                    "placeholder": PLACEHOLDER_PATTERN,
                },
            )
            stale = (await connection.execute(text("SELECT count(*) FROM e2e_users"))).scalar_one()
            print(f"[e2e reset] {stale} stale e2e user(s) in the store")
            if dry_run:
                return int(stale)
            for table, statement in STATEMENTS:
                result = await connection.execute(text(statement))
                deleted = result.rowcount if result.rowcount is not None else 0
                total += max(deleted, 0)
                if deleted:
                    print(f"[e2e reset] {table}: {deleted} row(s)")
    finally:
        await engine.dispose()
    print(f"[e2e reset] deleted {total} row(s)")
    return total


def main(argv: list[str]) -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("[e2e reset] DATABASE_URL is unset; nothing to reset", file=sys.stderr)
        return 1
    asyncio.run(reset(url, "--dry-run" in argv))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
