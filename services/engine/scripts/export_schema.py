"""Export the Pydantic contract as canonical JSON Schema for the Zod parity test.

Usage (from services/engine):
    uv run python scripts/export_schema.py            # writes packages/contracts/src/schema.json
    uv run python scripts/export_schema.py --check    # exits 1 when the committed file is stale

Canonical form: `$ref`s are inlined and `$defs` dropped, `title`/`description`/`discriminator`
keywords are removed (Pydantic decoration, not contract), `required` lists are sorted. The
Vitest in packages/contracts/test applies the same normalisation to Zod's output.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from pydantic import BaseModel, TypeAdapter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.brief import VentureBrief  # noqa: E402
from app.models.chat import ChatResponse, ChatTurn  # noqa: E402
from app.models.engine import Gap, ReasoningPath  # noqa: E402
from app.models.route import VentureRoute  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "packages" / "contracts" / "src" / "schema.json"

DECORATION_KEYWORDS = frozenset({"title", "description", "discriminator", "$schema"})

Json = dict[str, Any]


def _resolve_ref(ref: str, defs: Json) -> Json:
    prefix = "#/$defs/"
    if not ref.startswith(prefix):
        raise ValueError(f"unsupported $ref {ref!r}")
    resolved: Json = defs[ref[len(prefix) :]]
    return resolved


def canonical(schema: Any, defs: Json | None = None) -> Any:
    """Inline refs, strip decoration keywords, sort `required`. Property maps are left intact."""
    if isinstance(schema, list):
        return [canonical(item, defs) for item in schema]
    if not isinstance(schema, dict):
        return schema
    defs = {**(defs or {}), **schema.get("$defs", {})}
    if "$ref" in schema:
        rest = {k: v for k, v in schema.items() if k != "$ref"}
        return canonical({**_resolve_ref(schema["$ref"], defs), **rest}, defs)
    if isinstance(schema.get("type"), list):
        # `type: [T, "null"]` and `anyOf: [{type: T}, {type: null}]` mean the same; use anyOf.
        rest = {k: v for k, v in schema.items() if k != "type"}
        schema = {**rest, "anyOf": [{"type": t} for t in schema["type"]]}
    out: Json = {}
    for key, value in schema.items():
        if key in DECORATION_KEYWORDS or key == "$defs":
            continue
        if key == "properties":
            out[key] = {name: canonical(prop, defs) for name, prop in value.items()}
        elif key == "required":
            out[key] = sorted(value)
        else:
            out[key] = canonical(value, defs)
    return out


def export() -> Json:
    def model(cls: type[BaseModel]) -> Json:
        return canonical(cls.model_json_schema(mode="validation"))

    return {
        "VentureBrief": model(VentureBrief),
        "VentureRoute": model(VentureRoute),
        "ChatTurn": model(ChatTurn),
        "ChatResponse": canonical(TypeAdapter(ChatResponse).json_schema(mode="validation")),
        "ReasoningPath": model(ReasoningPath),
        "Gap": model(Gap),
    }


def render(schema: Json) -> str:
    return json.dumps(schema, indent=2, sort_keys=True) + "\n"


def main(argv: list[str]) -> int:
    text = render(export())
    if "--check" in argv:
        current = SCHEMA_PATH.read_text(encoding="utf-8") if SCHEMA_PATH.exists() else ""
        if current != text:
            print(f"{SCHEMA_PATH} is stale; run scripts/export_schema.py", file=sys.stderr)
            return 1
        print(f"{SCHEMA_PATH} is up to date")
        return 0
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(text, encoding="utf-8")
    print(f"wrote {SCHEMA_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
