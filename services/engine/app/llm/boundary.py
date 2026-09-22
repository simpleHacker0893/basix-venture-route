"""Explanation boundary: an LLM summary may name only entities already in the route.

`outside_entities` compares the text against the engine's known entity ids (and their display
names) minus the ids the route carries. A non-empty result means the explanation is rejected
and the deterministic template summary is kept (acceptance.md "LLM boundary test").
"""

from __future__ import annotations

from app.models.route import VentureRoute
from app.routing.presenter import display_name


def route_entities(route: VentureRoute) -> frozenset[str]:
    ids: set[str] = {b.builder_id for b in route.builders}
    if route.reusable_ip is not None:
        ids.add(route.reusable_ip.asset_id)
    if route.cohort is not None:
        ids.update({route.cohort.cohort_id, route.cohort.university_id})
    if route.partner is not None:
        ids.add(route.partner.partner_id)
    for gap in route.gaps:
        ids.update(gap.affected)
    return frozenset(ids)


def outside_entities(text: str, route: VentureRoute, known: frozenset[str]) -> frozenset[str]:
    """Known entity ids named in `text` (by id or display name) that the route does not carry."""
    allowed = route_entities(route)
    lowered = text.lower()
    named = {
        entity
        for entity in known
        if entity.lower() in lowered or display_name(entity).lower() in lowered
    }
    return frozenset(named - allowed)
