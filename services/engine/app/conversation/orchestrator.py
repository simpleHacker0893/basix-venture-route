"""Orchestrator: one founder turn -> exactly one ChatResponse (PRD §5.2; requirements.md item 6).

Merge `currentBrief` with the adapter's extraction (the latest explicit value wins), compute the
missing fields, then either ask with template questions or validate and call the injected route
function. The LLM never sets status and never receives facts: `explain_route` gets the
structured route only, and its text is kept only if it names no entity outside the route.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Callable

from pydantic import ValidationError

from app.llm.base import ExtractedBrief, LlmAdapter, LlmUnavailable
from app.llm.boundary import outside_entities
from app.models.brief import VentureBrief
from app.models.chat import (
    BriefField,
    ChatResponse,
    ChatTurn,
    ClarificationResponse,
    PartialBrief,
    RouteResponse,
    ValidationErrorResponse,
)
from app.models.route import VentureRoute
from app.models.validation import validation_message

log = logging.getLogger(__name__)

RouteFunction = Callable[[VentureBrief], VentureRoute]

# Fields a founder must supply, in PRD §5.3 order; `location` joins when the mode is on-site.
REQUIRED_FIELDS: tuple[BriefField, ...] = (
    "title",
    "vertical",
    "requiredSkills",
    "maximumTeamSize",
    "availabilityStart",
    "availabilityEnd",
    "deliveryMode",
    "dailyBudget",
    "preferReusableIp",
)

# Clarification questions are template strings keyed by field, never LLM output (blueprint 5).
QUESTIONS: dict[BriefField, str] = {
    "id": "id: a short identifier for the brief",
    "title": "title: what are you building, in one line?",
    "vertical": "vertical: health, agri or education?",
    "requiredSkills": (
        "requiredSkills: which of python, ai-metta, ui-ux, frontend, backend, "
        "domain-research, mobile, rust, data do you need?"
    ),
    "maximumTeamSize": "maximumTeamSize: how many builders at most (1 to 5)?",
    "availabilityStart": "availabilityStart: first day of the engagement (YYYY-MM-DD)?",
    "availabilityEnd": "availabilityEnd: last day of the engagement (YYYY-MM-DD)?",
    "deliveryMode": "deliveryMode: remote, hybrid or on-site?",
    "location": "location: which town or city for on-site work?",
    "dailyBudget": "dailyBudget: your budget in USD per day?",
    "preferReusableIp": "preferReusableIp: should we look for reusable IP (yes or no)?",
}

FORM_FALLBACK_HINT = (
    "The language model is unavailable right now; fill in the structured form and the route "
    "will be identical."
)
ROUTE_MESSAGE = "Here is the route the engine computed for your brief."
CLARIFICATION_PREFIX = "To route this brief I still need:"


class Orchestrator:
    def __init__(
        self,
        adapter: LlmAdapter,
        route: RouteFunction,
        known_entities: frozenset[str] = frozenset(),
    ) -> None:
        self._adapter = adapter
        self._route = route
        self._known = known_entities

    def handle(self, turn: ChatTurn) -> ChatResponse:
        current = turn.current_brief or PartialBrief()
        llm_down = False
        try:
            extracted = self._adapter.extract_brief(turn.user_message, current)
        except LlmUnavailable as exc:
            log.warning("LLM unavailable during extraction: %s", exc)
            extracted, llm_down = ExtractedBrief(), True

        merged = merge(current, extracted)
        missing = missing_fields(merged)
        if missing:
            questions = "\n".join(f"- {QUESTIONS[field]}" for field in missing)
            message = f"{CLARIFICATION_PREFIX}\n{questions}"
            if llm_down:
                message = f"{FORM_FALLBACK_HINT}\n{message}"
            return ClarificationResponse(
                type="clarification",
                missing_fields=missing,
                message=message,
                partial_brief=merged,
            )

        try:
            brief = to_brief(merged)
        except ValidationError as exc:
            return ValidationErrorResponse(type="validation-error", message=validation_message(exc))

        route = self._route(brief)
        if not llm_down:
            route = self._explained(route)
        return RouteResponse(
            type="route",
            brief=brief,
            route=route,
            message=FORM_FALLBACK_HINT if llm_down else ROUTE_MESSAGE,
        )

    def _explained(self, route: VentureRoute) -> VentureRoute:
        """Adopt the adapter's summary only when it names nothing outside the route."""
        try:
            text = self._adapter.explain_route(route).strip()
        except LlmUnavailable as exc:
            log.warning("LLM unavailable during explanation: %s", exc)
            return route
        if not text:
            return route
        strangers = outside_entities(text, route, self._known)
        if strangers:
            log.warning(
                "explanation named entities outside the route (%s); using template summary",
                ", ".join(sorted(strangers)),
            )
            return route
        return route.model_copy(update={"summary": text})


def merge(current: PartialBrief, extracted: ExtractedBrief) -> PartialBrief:
    """Extracted values (the latest message) override the current brief; None means unsaid."""
    values = current.model_dump(by_alias=True)
    values.update(extracted.model_dump(by_alias=True, exclude_none=True))
    return PartialBrief.model_validate(values)


def missing_fields(brief: PartialBrief) -> list[BriefField]:
    values = brief.model_dump(by_alias=True)
    missing: list[BriefField] = [field for field in REQUIRED_FIELDS if values[field] is None]
    if brief.delivery_mode == "on-site" and not brief.location:
        missing.append("location")
    return missing


def to_brief(partial: PartialBrief) -> VentureBrief:
    values = partial.model_dump(by_alias=True, exclude_none=True)
    values.setdefault("id", brief_id_for(partial.title or ""))
    return VentureBrief.model_validate(values)


def brief_id_for(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40].strip("-")
    return f"brief-{slug or 'untitled'}"
