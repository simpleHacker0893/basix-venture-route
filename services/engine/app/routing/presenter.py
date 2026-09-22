"""Display names derived from seed IDs (D-24). The seed carries no name facts."""

_ASSET_PREFIX = "asset-"


def display_name(builder_id: str) -> str:
    """`amina-otieno` -> "Amina Otieno"."""
    return " ".join(part.capitalize() for part in builder_id.split("-") if part)


def asset_title(asset_id: str) -> str:
    """`asset-afya-triage` -> "Afya Triage" (same helper, asset prefix dropped)."""
    bare = asset_id.removeprefix(_ASSET_PREFIX)
    return display_name(bare)
