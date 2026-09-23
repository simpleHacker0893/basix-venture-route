"""Generate the offline demo snapshot from the real route service (D-34).

Usage (from services/engine):
    uv run python scripts/export_offline_snapshot.py            # writes the snapshot JSON
    uv run python scripts/export_offline_snapshot.py --check    # exits 1 when the file is stale

Output: apps/web/src/offline/snapshot.json (the folder is created when missing).

The snapshot is `{briefs, routes}` keyed by seed brief id, in seed order, camelCase on the wire,
exactly what `POST /api/route` answers for each brief with `LLM_PROVIDER=null`. The web app reads
it only when `VITE_OFFLINE_DEMO=1`. It is generated, never hand-edited: a hand-written JSON would
be a matcher by another name (AGENTS.md rule 1).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

os.environ.setdefault("LLM_PROVIDER", "null")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402
from app.engine.metta_engine import MettaRouteEngine  # noqa: E402
from app.models.brief import load_seed_briefs  # noqa: E402
from app.routing.route_service import RouteService  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT_PATH = REPO_ROOT / "apps" / "web" / "src" / "offline" / "snapshot.json"

Json = dict[str, Any]


def build_snapshot() -> Json:
    settings = Settings(llm_provider="null")
    engine = MettaRouteEngine(settings)
    service = RouteService(engine)
    briefs = load_seed_briefs(settings.seed_dir / "briefs.json")
    return {
        "briefs": {brief.id: brief.model_dump(mode="json", by_alias=True) for brief in briefs},
        "routes": {
            brief.id: service.route(brief).model_dump(mode="json", by_alias=True)
            for brief in briefs
        },
    }


def render(snapshot: Json) -> str:
    return json.dumps(snapshot, indent=2) + "\n"


def main(argv: list[str]) -> int:
    text = render(build_snapshot())
    if "--check" in argv:
        current = SNAPSHOT_PATH.read_text(encoding="utf-8") if SNAPSHOT_PATH.exists() else ""
        if current != text:
            print(
                f"{SNAPSHOT_PATH} is stale; run scripts/export_offline_snapshot.py", file=sys.stderr
            )
            return 1
        print(f"{SNAPSHOT_PATH} is up to date")
        return 0
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {SNAPSHOT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
