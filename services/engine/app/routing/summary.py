"""Deterministic template summary for a VentureRoute.

Used when no LLM is configured, when the LLM is unavailable, and when an LLM explanation names
an entity outside the route (acceptance.md "LLM boundary test"). Restates only what the route
already holds; it selects nothing and invents nothing.
"""

from app.models.route import VentureRoute


def template_summary(route: VentureRoute) -> str:
    if route.status == "infeasible":
        skills = ", ".join(gap.affected[0] for gap in route.gaps if gap.affected)
        categories = ", ".join(sorted({gap.category for gap in route.gaps}))
        return (
            f"No eligible builder for {skills or 'the required skills'} "
            f"({len(route.gaps)} {categories} gap{'s' if len(route.gaps) != 1 else ''}). "
            "Review the next actions on each gap."
        )
    parts: list[str] = []
    if route.builders:
        names = ", ".join(b.name for b in route.builders)
        covered = ", ".join(sorted({skill for b in route.builders for skill in b.covers}))
        parts.append(
            f"{len(route.builders)} builder{'s' if len(route.builders) != 1 else ''} "
            f"({names}) cover {covered} for USD {route.total_daily_rate} a day."
        )
    if route.reusable_ip is not None:
        parts.append(f"Reusable IP: {route.reusable_ip.title}.")
    if route.partner is not None:
        parts.append(f"Partner: {route.partner.partner_id}.")
    if route.gaps:
        gaps = "; ".join(f"{gap.category} ({', '.join(gap.affected)})" for gap in route.gaps)
        parts.append(f"Gaps: {gaps}.")
    label = "Feasible route" if route.status == "feasible" else "Partial route"
    return f"{label}: " + " ".join(parts)
