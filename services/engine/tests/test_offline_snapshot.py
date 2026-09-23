"""Seam: the generated offline snapshot equals POST /api/route for the five seed briefs (D-34)."""

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from export_offline_snapshot import SNAPSHOT_PATH, build_snapshot, render  # noqa: E402

pytestmark = pytest.mark.runtime

SEED_IDS = [
    "brief-health-01",
    "brief-agri-01",
    "brief-constrained-01",
    "brief-budget-01",
    "brief-onsite-01",
]


def test_committed_snapshot_is_up_to_date() -> None:
    assert SNAPSHOT_PATH.exists(), "run scripts/export_offline_snapshot.py"

    assert SNAPSHOT_PATH.read_text(encoding="utf-8") == render(build_snapshot())


def test_snapshot_routes_equal_the_form_path_for_every_seed_brief(client: TestClient) -> None:
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))

    assert list(snapshot["briefs"]) == SEED_IDS
    assert list(snapshot["routes"]) == SEED_IDS
    for brief_id in SEED_IDS:
        live = client.post("/api/route", json=snapshot["briefs"][brief_id])
        assert live.status_code == 200, live.text
        assert snapshot["routes"][brief_id] == live.json(), brief_id
        assert snapshot["briefs"][brief_id]["demoData"] is True


def test_snapshot_is_keyed_by_brief_id_and_carries_the_five_statuses() -> None:
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))

    assert [snapshot["routes"][i]["status"] for i in SEED_IDS] == [
        "feasible",
        "feasible",
        "partial",
        "partial",
        "infeasible",
    ]
