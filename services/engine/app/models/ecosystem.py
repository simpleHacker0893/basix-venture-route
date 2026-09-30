"""The seed ecosystem as the footer's Partners page shows it (#79): partners with the verticals
they support, universities with their cohorts, and the licensable assets that `reuse-fit` can
pick. Read from graph predicates with plain `match` queries; no rule decides anything here.

Mirrors `packages/contracts/src/ecosystem.ts`; the parity test keeps the two equal.
"""

from app.models.brief import Vertical
from app.models.engine import EngineModel


class EcosystemPartner(EngineModel):
    partner_id: str
    verticals: list[Vertical]


class EcosystemUniversity(EngineModel):
    university_id: str
    cohorts: list[str]


class EcosystemAsset(EngineModel):
    asset_id: str
    title: str
    vertical: Vertical


class Ecosystem(EngineModel):
    partners: list[EcosystemPartner]
    universities: list[EcosystemUniversity]
    assets: list[EcosystemAsset]
    # Every seed entity is fictional (AGENTS.md rule 5).
    demo_data: bool = True
