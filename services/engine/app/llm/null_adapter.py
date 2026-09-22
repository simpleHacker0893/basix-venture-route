"""NullAdapter: the LLM-free path used when no key is configured or LLM_PROVIDER=null."""

from __future__ import annotations

from app.llm.base import ExtractedBrief
from app.models.chat import PartialBrief
from app.models.route import VentureRoute


class NullAdapter:
    """Extracts nothing (the structured form supplies every field) and explains with the
    route's own template summary, so `/api/conversation` equals `/api/route` byte for byte."""

    name = "null"

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        return ExtractedBrief()

    def explain_route(self, route: VentureRoute) -> str:
        return route.summary
