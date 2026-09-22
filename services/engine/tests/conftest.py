"""Shared fixtures. Every test here runs the real Hyperon runtime (no mocks, D-19)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief, load_seed_briefs


@pytest.fixture(scope="session")
def engine() -> MettaRouteEngine:
    return MettaRouteEngine(get_settings())


@pytest.fixture(scope="session")
def briefs() -> dict[str, VentureBrief]:
    return {brief.id: brief for brief in load_seed_briefs(get_settings().seed_dir / "briefs.json")}


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
