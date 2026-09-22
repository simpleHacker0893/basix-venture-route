"""Shared fixtures. Every test here runs the real Hyperon runtime (no mocks, D-19).

The suite runs with LLM_PROVIDER=null unless the environment says otherwise, so no test ever
reaches a language model; the Anthropic adapter is exercised with a fake transport (#17).
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("LLM_PROVIDER", "null")

from app.config import get_settings  # noqa: E402
from app.engine.metta_engine import MettaRouteEngine  # noqa: E402
from app.models.brief import VentureBrief, load_seed_briefs  # noqa: E402


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
