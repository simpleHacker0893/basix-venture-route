"""Seams: HTTP /api/admin/* with a fake admin JWT, and `reproject()` observed only through
`GET /health` and `POST /api/route` (D-15, D-19, spec #35 §Admin, §Projection).

Acceptance: "Admin confirms account, credential and project → `GET /health` shows
`projected_rows` increased → the same route now includes the builder with evidence `both`."
"Admin rejects the project → after reprojection the builder's evidence is `credential` only."
Should: "Reprojection latency < 3 s on demo-size data (pasted timing)."

The brief is the seed Constrained brief (mobile + rust, remote, team ≤ 2, USD 300): no seed
builder is verified for `mobile`, so a confirmed user-entered builder with a mobile credential
and a mobile project is the only way that gap can close. The cast (admin, founder, the pending
Naomi Chebet, the confirmed one) comes from the shared conftest fixtures (Sprint 004, #55).
"""

import time
from typing import Any

import pytest
from httpx import AsyncClient
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import Confirmation
from tests.conftest import Actor

pytestmark = pytest.mark.anyio

CONSTRAINED = "brief-constrained-01"


async def _route(api: AsyncClient) -> dict[str, Any]:
    briefs = (await api.get("/api/scenarios")).json()
    brief = next(b for b in briefs if b["id"] == CONSTRAINED)
    response = await api.post("/api/route", json=brief)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


def _evidence(route: dict[str, Any], builder_id: str) -> str | None:
    for builder in route["builders"]:
        if builder["builderId"] == builder_id:
            evidence: str = builder["evidenceType"]
            return evidence
    return None


# -- the queue --------------------------------------------------------------------


async def test_pending_queue_lists_the_builder_account_credential_and_project(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    ids = unconfirmed_builder.ids

    response = await api.get("/api/admin/pending", headers=admin.headers)

    assert response.status_code == 200
    body = response.json()
    assert [(a["id"], a["role"], a["builderId"], a["displayName"]) for a in body["accounts"]] == [
        (ids["account"], "builder", "naomi-chebet", "Naomi Chebet")
    ]
    assert [(c["id"], c["builderId"], c["skillId"]) for c in body["credentials"]] == [
        (ids["credential"], "naomi-chebet", "mobile")
    ]
    assert [
        (p["id"], p["builderId"], p["skillIds"], p["licensable"]) for p in body["projects"]
    ] == [(ids["project"], "naomi-chebet", ["mobile"], True)]
    assert all(row["demoData"] is True for rows in body.values() for row in rows)


async def test_queue_is_admin_only(api: AsyncClient, founder: Actor) -> None:
    response = await api.get("/api/admin/pending", headers=founder.headers)

    assert response.status_code == 403


# -- confirm, reject, reproject ------------------------------------------------------


async def test_confirm_then_reject_flows_into_the_route(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    builder, ids = unconfirmed_builder.headers, unconfirmed_builder.ids
    before_health = (await api.get("/health")).json()
    before_route = await _route(api)
    assert before_health["projected_rows"] == 0
    assert _evidence(before_route, "naomi-chebet") is None
    assert any(gap["category"] == "skill" for gap in before_route["gaps"])

    started = time.perf_counter()
    account = await api.post(f"/api/admin/confirm/account/{ids['account']}", headers=admin.headers)
    elapsed_account = time.perf_counter() - started
    credential = await api.post(
        f"/api/admin/confirm/credential/{ids['credential']}", headers=admin.headers
    )
    project = await api.post(f"/api/admin/confirm/project/{ids['project']}", headers=admin.headers)
    print(f"\nreprojection (confirm account): {elapsed_account * 1000:.0f} ms")

    assert account.status_code == 200
    assert account.json()["status"] == "confirmed"
    assert account.json()["projectedRows"] > 0
    assert project.json()["projectedRows"] > credential.json()["projectedRows"]
    after_health = (await api.get("/health")).json()
    assert after_health["projected_rows"] == project.json()["projectedRows"]
    assert after_health["facts_loaded"] == before_health["facts_loaded"]
    after_route = await _route(api)
    assert _evidence(after_route, "naomi-chebet") == "both"
    assert after_route["status"] == "feasible"
    assert (
        next(b for b in after_route["builders"] if b["builderId"] == "naomi-chebet")["name"]
        == "Naomi Chebet"
    )
    profile = await api.get("/api/me/profile", headers=builder)
    assert profile.json()["confirmed"] is True
    assert [s["evidence"] for s in profile.json()["skills"] if s["id"] == "mobile"] == ["both"]
    assert elapsed_account < 3.0, "Should: reprojection latency < 3 s"

    rejected = await api.post(f"/api/admin/reject/project/{ids['project']}", headers=admin.headers)

    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["projectedRows"] < project.json()["projectedRows"]
    assert _evidence(await _route(api), "naomi-chebet") == "credential"
    profile = await api.get("/api/me/profile", headers=builder)
    assert [s["evidence"] for s in profile.json()["skills"] if s["id"] == "mobile"] == [
        "credential"
    ]


async def test_rejecting_the_account_removes_the_builder_from_the_graph(
    api: AsyncClient, admin: Actor, confirmed_builder: Actor
) -> None:
    assert _evidence(await _route(api), "naomi-chebet") == "both"

    response = await api.post(
        f"/api/admin/reject/account/{confirmed_builder.ids['account']}", headers=admin.headers
    )

    assert response.status_code == 200
    assert response.json()["projectedRows"] == 0
    assert (await api.get("/health")).json()["projected_rows"] == 0
    assert _evidence(await _route(api), "naomi-chebet") is None


async def test_decisions_can_be_reversed_and_are_logged(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor, db_session: AsyncSession
) -> None:
    credential_id = unconfirmed_builder.ids["credential"]

    first = await api.post(f"/api/admin/reject/credential/{credential_id}", headers=admin.headers)
    second = await api.post(f"/api/admin/confirm/credential/{credential_id}", headers=admin.headers)

    assert (first.json()["status"], second.json()["status"]) == ("rejected", "confirmed")
    pending = (await api.get("/api/admin/pending", headers=admin.headers)).json()
    assert pending["credentials"] == []
    log = (await db_session.exec(select(Confirmation).order_by(col(Confirmation.created_at)))).all()
    assert [(row.kind, row.decision) for row in log] == [
        ("credential", "rejected"),
        ("credential", "confirmed"),
    ]


async def test_unknown_target_is_404_and_unknown_kind_is_422(
    api: AsyncClient, admin: Actor
) -> None:
    missing = await api.post(
        "/api/admin/confirm/project/00000000-0000-0000-0000-000000000000", headers=admin.headers
    )
    bad_kind = await api.post(
        "/api/admin/confirm/booking/00000000-0000-0000-0000-000000000000", headers=admin.headers
    )

    assert missing.status_code == 404
    assert bad_kind.status_code == 422
