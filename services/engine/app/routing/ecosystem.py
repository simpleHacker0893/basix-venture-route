"""The Ecosystem view over the engine (#79): one function shared by `GET /api/ecosystem` and the
offline snapshot export, so the footer's Partners page reads the same seed entities either way."""

from app.engine.metta_engine import MettaRouteEngine
from app.models.ecosystem import Ecosystem, EcosystemAsset, EcosystemPartner, EcosystemUniversity
from app.routing.presenter import asset_title


def ecosystem_view(engine: MettaRouteEngine) -> Ecosystem:
    partners, universities, assets = engine.ecosystem()
    return Ecosystem(
        partners=[
            EcosystemPartner(partner_id=partner, verticals=verticals)
            for partner, verticals in partners.items()
        ],
        universities=[
            EcosystemUniversity(university_id=university, cohorts=cohorts)
            for university, cohorts in universities.items()
        ],
        assets=[
            EcosystemAsset(asset_id=asset, title=asset_title(asset), vertical=vertical)
            for asset, vertical in assets
        ],
    )
