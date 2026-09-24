"""Seam: HTTP /api/admin/decided with a fake admin JWT, reprojection observed through
`GET /health` and `POST /api/route` (D-15, D-19, spec #35 story 24, #49).

An admin reverses a mistaken confirm or reject from the decided list. The list shows every
confirmed or rejected account, credential and project with its status and the timestamp of the
latest `confirmations` row; pending rows and admin accounts are absent.
"""

from datetime import datetime
from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import Actor
from tests.test_admin_queue import _evidence, _route

pytestmark = pytest.mark.anyio


async def _decided(api: AsyncClient, admin: Actor) -> dict[str, Any]:
    response = await api.get("/api/admin/decided", headers=admin.headers)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


def _offset_aware(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    assert parsed.tzinfo is not None, f"decidedAt must carry an offset: {value}"
    return parsed


# -- the decided list -----------------------------------------------------------------


async def test_decided_list_is_empty_while_everything_is_pending(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    body = await _decided(api, admin)

    assert body == {"accounts": [], "credentials": [], "projects": []}


async def test_decided_list_shows_confirmed_and_rejected_rows_with_the_last_decision(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    ids = unconfirmed_builder.ids
    await api.post(f"/api/admin/confirm/account/{ids['account']}", headers=admin.headers)
    await api.post(f"/api/admin/confirm/credential/{ids['credential']}", headers=admin.headers)
    await api.post(f"/api/admin/reject/project/{ids['project']}", headers=admin.headers)

    body = await _decided(api, admin)

    assert [(a["id"], a["role"], a["builderId"], a["status"]) for a in body["accounts"]] == [
        (ids["account"], "builder", "naomi-chebet", "confirmed")
    ]
    assert [(c["id"], c["skillId"], c["status"]) for c in body["credentials"]] == [
        (ids["credential"], "mobile", "confirmed")
    ]
    assert [(p["id"], p["skillIds"], p["status"]) for p in body["projects"]] == [
        (ids["project"], ["mobile"], "rejected")
    ]
    for rows in body.values():
        for row in rows:
            assert row["demoData"] is True
            assert _offset_aware(row["decidedAt"]) >= _offset_aware(row["submittedAt"])
    pending = (await api.get("/api/admin/pending", headers=admin.headers)).json()
    assert pending == {"accounts": [], "credentials": [], "projects": []}


async def test_decided_list_keeps_pending_rows_and_admin_accounts_out(
    api: AsyncClient, admin: Actor, founder: Actor, unconfirmed_builder: Actor
) -> None:
    ids = unconfirmed_builder.ids
    await api.post(f"/api/admin/confirm/credential/{ids['credential']}", headers=admin.headers)

    body = await _decided(api, admin)

    # The admin is a confirmed users row but is never decided on, so it is absent; the
    # builder's account and project are still pending, and so is the founder.
    assert body["accounts"] == []
    assert [c["id"] for c in body["credentials"]] == [ids["credential"]]
    assert body["projects"] == []


async def test_decided_at_follows_the_latest_decision(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    credential_id = unconfirmed_builder.ids["credential"]
    await api.post(f"/api/admin/reject/credential/{credential_id}", headers=admin.headers)
    first = _offset_aware((await _decided(api, admin))["credentials"][0]["decidedAt"])

    await api.post(f"/api/admin/confirm/credential/{credential_id}", headers=admin.headers)
    rows = (await _decided(api, admin))["credentials"]

    assert [(row["id"], row["status"]) for row in rows] == [(credential_id, "confirmed")]
    assert _offset_aware(rows[0]["decidedAt"]) >= first


async def test_decided_list_is_admin_only(api: AsyncClient, founder: Actor) -> None:
    response = await api.get("/api/admin/decided", headers=founder.headers)

    assert response.status_code == 403


# -- reverse: confirm, reject, confirm the same credential --------------------------------


async def test_reversing_the_credential_keeps_health_and_the_route_in_step(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    ids = unconfirmed_builder.ids
    await api.post(f"/api/admin/confirm/account/{ids['account']}", headers=admin.headers)
    await api.post(f"/api/admin/confirm/project/{ids['project']}", headers=admin.headers)
    assert _evidence(await _route(api), "naomi-chebet") == "project"

    async def health() -> int:
        rows: int = (await api.get("/health")).json()["projected_rows"]
        return rows

    confirmed = await api.post(
        f"/api/admin/confirm/credential/{ids['credential']}", headers=admin.headers
    )
    assert confirmed.json()["projectedRows"] == await health()
    assert _evidence(await _route(api), "naomi-chebet") == "both"
    assert [c["status"] for c in (await _decided(api, admin))["credentials"]] == ["confirmed"]

    rejected = await api.post(
        f"/api/admin/reject/credential/{ids['credential']}", headers=admin.headers
    )
    assert rejected.json()["projectedRows"] == await health()
    assert rejected.json()["projectedRows"] < confirmed.json()["projectedRows"]
    assert _evidence(await _route(api), "naomi-chebet") == "project"
    assert [c["status"] for c in (await _decided(api, admin))["credentials"]] == ["rejected"]

    reconfirmed = await api.post(
        f"/api/admin/confirm/credential/{ids['credential']}", headers=admin.headers
    )
    assert reconfirmed.json()["projectedRows"] == await health()
    assert reconfirmed.json()["projectedRows"] == confirmed.json()["projectedRows"]
    assert _evidence(await _route(api), "naomi-chebet") == "both"
    assert [c["status"] for c in (await _decided(api, admin))["credentials"]] == ["confirmed"]
