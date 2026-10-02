"""Seam: deploy config drift (#137, D-57). The Render Blueprint, the engine Dockerfile and the
Vercel project config are loaded from the repo and checked against the engine Settings class,
so a new setting or a moved path cannot ship without the deploy files noticing."""

import json
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient

from app.config import REPO_ROOT, Settings
from app.main import create_app

BLUEPRINT = REPO_ROOT / "render.yaml"
VERCEL_CONFIG = REPO_ROOT / "apps" / "web" / "vercel.json"

# Settings that carry a credential or a deployment-specific value: the Blueprint lists the key
# with `sync: false` (Render prompts for it) and never a literal.
SECRET_SETTINGS = {
    "database_url",
    "database_url_direct",
    "anthropic_api_key",
    "openrouter_api_key",
    "clerk_jwks_url",
    "clerk_secret_key",
    "clerk_webhook_signing_secret",
    "admin_emails",
    "cors_origins",
}

# Settings the Blueprint deliberately leaves out, each with the reason. Anything that is neither
# here, in SECRET_SETTINGS nor given a plain value fails the test.
EXCLUDED_SETTINGS = {
    "engine_port": "compose host port only; Render uses PORT",
    "seed_dir": "defaults to the seed folder baked into the image",
    "openrouter_base_url": "the default is the production endpoint",
    "test_database_url": "pytest only, never read by the running engine",
    "alembic_database_url": "one-off migration override; the Blueprint sets DATABASE_URL_DIRECT",
}

# Plain values the Blueprint must carry, as data. Strings, because Render env values are strings.
EXPECTED_PLAIN_VALUES = {
    "PORT": "8000",
    "ENGINE_DEV_QUERY": "0",
    "LLM_PROVIDER": "anthropic",
    "VOICE_TRUSTED_PROXY_HOPS": "1",
}


def _service() -> dict[str, Any]:
    blueprint = yaml.safe_load(BLUEPRINT.read_text(encoding="utf-8"))
    services = blueprint["services"]
    assert len(services) == 1
    service: dict[str, Any] = services[0]
    return service


def _env_vars() -> dict[str, dict[str, Any]]:
    return {entry["key"]: entry for entry in _service()["envVars"]}


def test_blueprint_declares_the_single_docker_engine_service() -> None:
    service = _service()

    assert service["type"] == "web"
    assert service["name"] == "venture-route-engine"
    assert service["runtime"] == "docker"
    assert service["region"] == "ohio"
    assert service["branch"] == "master"
    assert service["autoDeploy"] is True
    assert service["numInstances"] == 1
    assert service["healthCheckPath"] == "/health"
    assert service["preDeployCommand"] == "alembic upgrade head"


def test_blueprint_dockerfile_and_context_exist() -> None:
    service = _service()
    context = (BLUEPRINT.parent / service["dockerContext"]).resolve()
    dockerfile = (BLUEPRINT.parent / service["dockerfilePath"]).resolve()

    assert context.is_dir()
    assert dockerfile.is_file()
    assert dockerfile.is_relative_to(context)


def test_every_engine_setting_is_in_the_blueprint_or_excluded_with_a_reason() -> None:
    names = {key.lower() for key in _env_vars()}
    expected = set(Settings.model_fields) - set(EXCLUDED_SETTINGS)

    assert expected - names == set()
    assert set(EXCLUDED_SETTINGS) <= set(Settings.model_fields)
    assert not names & set(EXCLUDED_SETTINGS)
    assert expected >= SECRET_SETTINGS


def test_secret_keys_are_prompted_never_literal() -> None:
    env_vars = _env_vars()

    for setting in SECRET_SETTINGS:
        entry = env_vars[setting.upper()]
        assert entry.get("sync") is False, setting
        assert "value" not in entry, setting
        assert "generateValue" not in entry, setting


def test_non_secret_keys_carry_literal_string_values() -> None:
    env_vars = _env_vars()
    plain = {key: entry for key, entry in env_vars.items() if key.lower() not in SECRET_SETTINGS}

    for key, entry in plain.items():
        assert isinstance(entry.get("value"), str), key
        assert "sync" not in entry, key
    for key, value in EXPECTED_PLAIN_VALUES.items():
        assert plain[key]["value"] == value


def test_health_returns_200_under_create_app() -> None:
    health_path = _service()["healthCheckPath"]
    app = create_app(Settings(database_url=None))

    with TestClient(app) as client:
        assert client.get(health_path).status_code == 200


@pytest.fixture(name="vercel")
def _vercel() -> dict[str, Any]:
    config: dict[str, Any] = json.loads(VERCEL_CONFIG.read_text(encoding="utf-8"))
    return config


def test_vercel_config_keeps_the_dist_output(vercel: dict[str, Any]) -> None:
    assert vercel["outputDirectory"] == "dist"


def test_vercel_config_keeps_the_spa_rewrite(vercel: dict[str, Any]) -> None:
    assert {"source": "/(.*)", "destination": "/index.html"} in vercel["rewrites"]
