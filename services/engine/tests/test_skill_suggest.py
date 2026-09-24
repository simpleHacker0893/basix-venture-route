"""Seam: HTTP `POST /api/me/skills/suggest` with an injected fake LlmAdapter (D-19, D-50; #95).

A builder pastes résumé text and gets skill chips. The adapter is the only thing faked; it enters
through `create_app(llm_adapter=...)`, so nothing is patched. The null adapter, a timeout or any
provider failure answer 200 `{available: false, suggestions: []}`, never a 5xx, and the text is
never logged (spec #86 Testing 4).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import JwksCache
from app.config import Settings
from app.engine.metta_engine import MettaRouteEngine
from app.llm.base import ExtractedBrief, LlmUnavailable
from app.main import create_app
from app.marketplace.models import User
from app.models.chat import PartialBrief
from app.models.route import VentureRoute
from tests.auth_fixtures import SigningKeys
from tests.conftest import FakeClerkAdmin

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]

MARKER = "ZQX-RESUME-MARKER-7731"
RESUME = (
    f"Jane Mwangi {MARKER}. Five years building Python backends and UI/UX design for clinics "
    "in Nairobi; shipped Figma prototypes and Kotlin mobile apps."
)
SUGGEST = "/api/me/skills/suggest"


class FakeAdapter:
    """Returns scripted labels, or raises the scripted error; records every text it received."""

    name = "fake"

    def __init__(self, labels: list[str] | None = None, error: Exception | None = None) -> None:
        self.labels = labels or []
        self.error = error
        self.received: list[str] = []

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        return ExtractedBrief()

    def explain_route(self, route: VentureRoute) -> str:
        return route.summary

    def suggest_skills(self, text: str) -> list[str]:
        self.received.append(text)
        if self.error is not None:
            raise self.error
        return self.labels


def _app(
    engine: MettaRouteEngine,
    settings: Settings,
    keys: SigningKeys,
    sessions: async_sessionmaker[AsyncSession],
    adapter: FakeAdapter | None,
) -> FastAPI:
    return create_app(
        settings,
        engine=engine,
        jwks_cache=JwksCache.preloaded(keys.jwks),
        session_factory=sessions,
        clerk_admin=FakeClerkAdmin(),
        llm_adapter=adapter,
    )


Client = Callable[[FakeAdapter | None], AbstractAsyncContextManager[AsyncClient]]


@pytest.fixture
def make_client(
    engine: MettaRouteEngine,
    marketplace_settings: Settings,
    test_keys: SigningKeys,
    session_factory: async_sessionmaker[AsyncSession],
) -> Client:
    """`async with make_client(adapter) as api:` the real app with that adapter injected."""

    @asynccontextmanager
    async def _client(adapter: FakeAdapter | None) -> AsyncIterator[AsyncClient]:
        app = _app(engine, marketplace_settings, test_keys, session_factory, adapter)
        try:
            async with (
                app.router.lifespan_context(app),
                AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as api,
            ):
                yield api
        finally:
            engine.replace_space("")

    return _client


@pytest.fixture
async def builder(db_session: AsyncSession, bearer: Bearer) -> dict[str, str]:
    db_session.add(User(clerk_id="user_cv", email="cv@example.com", role="builder"))
    await db_session.commit()
    return bearer(sub="user_cv", role="builder")


async def test_null_adapter_answers_unavailable_with_no_suggestions(
    make_client: Client,
    builder: dict[str, str],
) -> None:
    async with make_client(None) as api:
        response = await api.post(SUGGEST, json={"resumeText": RESUME}, headers=builder)

    assert response.status_code == 200
    assert response.json() == {"available": False, "suggestions": []}


async def test_vocabulary_matches_carry_the_skill_id_and_display_name_and_the_list_is_capped(
    make_client: Client,
    builder: dict[str, str],
) -> None:
    labels = [
        "ui/ux design",
        "  Python ",
        "PYTHON",  # duplicate of a vocabulary match, case-insensitively
        "UI/UX",  # same vocabulary skill spelled differently
        "Figma",
        "figma",  # free-text duplicate
        "Data engineering",
        "x" * 41,  # longer than a chip may be
        "   ",
    ] + [f"Skill {n}" for n in range(30)]
    adapter = FakeAdapter(labels)

    async with make_client(adapter) as api:
        response = await api.post(SUGGEST, json={"resumeText": RESUME}, headers=builder)

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    suggestions = body["suggestions"]
    assert len(suggestions) == 20
    assert suggestions[:4] == [
        {"label": "UI/UX design", "skillId": "ui-ux"},
        {"label": "Python", "skillId": "python"},
        {"label": "Figma", "skillId": None},
        {"label": "Data engineering", "skillId": "data"},
    ]
    assert suggestions[4:] == [{"label": f"Skill {n}", "skillId": None} for n in range(16)]
    assert adapter.received == [RESUME]


@pytest.mark.parametrize(
    "error",
    [
        LlmUnavailable("anthropic suggestion timed out"),
        TimeoutError("read timed out"),
        RuntimeError(f"provider echoed the prompt: {RESUME}"),
    ],
    ids=["llm-unavailable", "timeout", "leaky-provider-error"],
)
async def test_any_adapter_failure_is_unavailable_never_a_5xx_and_never_logs_the_text(
    make_client: Client,
    builder: dict[str, str],
    caplog: pytest.LogCaptureFixture,
    error: Exception,
) -> None:
    caplog.set_level(logging.DEBUG)
    async with make_client(FakeAdapter(error=error)) as api:
        response = await api.post(SUGGEST, json={"resumeText": RESUME}, headers=builder)

    assert response.status_code == 200
    assert response.json() == {"available": False, "suggestions": []}
    assert MARKER not in response.text
    for record in caplog.records:
        assert MARKER not in record.getMessage()
        assert MARKER not in (record.exc_text or "")
        assert MARKER not in logging.Formatter().format(record)


async def test_a_successful_suggestion_never_logs_the_text(
    make_client: Client,
    builder: dict[str, str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    async with make_client(FakeAdapter(["Python"])) as api:
        response = await api.post(SUGGEST, json={"resumeText": RESUME}, headers=builder)

    assert response.status_code == 200
    for record in caplog.records:
        assert MARKER not in logging.Formatter().format(record)


@pytest.mark.parametrize(
    "text", ["too short " + MARKER, MARKER + "x" * 20000], ids=["under-50", "over-20000"]
)
async def test_text_outside_50_to_20000_chars_is_422_without_echoing_it(
    make_client: Client,
    builder: dict[str, str],
    text: str,
) -> None:
    adapter = FakeAdapter(["Python"])
    async with make_client(adapter) as api:
        response = await api.post(SUGGEST, json={"resumeText": text}, headers=builder)

    assert response.status_code == 422
    assert "resumeText" in response.json()["message"]
    assert MARKER not in response.text
    assert adapter.received == []


async def test_no_token_is_401_and_a_founder_is_403(
    make_client: Client,
    db_session: AsyncSession,
    bearer: Bearer,
) -> None:
    db_session.add(User(clerk_id="user_f", email="f@example.com", role="founder"))
    await db_session.commit()
    adapter = FakeAdapter(["Python"])

    async with make_client(adapter) as api:
        anonymous = await api.post(SUGGEST, json={"resumeText": RESUME})
        founder = await api.post(
            SUGGEST, json={"resumeText": RESUME}, headers=bearer(sub="user_f", role="founder")
        )

    assert anonymous.status_code == 401
    assert founder.status_code == 403
    assert adapter.received == []
