"""MettaRouteEngine: loads the seed graph and named rules into one Hyperon space."""

from __future__ import annotations

import importlib.metadata
import re
import threading
from pathlib import Path

from hyperon import MeTTa

from app.config import Settings
from app.engine.errors import EngineError
from app.engine.grounded import register_grounded_atoms

_RULE_HEAD = re.compile(r"^\(=\s*\(([a-z][a-z0-9-]*)\b", re.MULTILINE)


class MettaRouteEngine:
    """Owns the MeTTa instance. All decisions come from the named rules in rules.metta."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        try:
            self._metta = MeTTa()
        except Exception as exc:  # pragma: no cover - only when the native runtime is broken
            raise EngineError("Hyperon runtime failed to start") from exc
        register_grounded_atoms(self._metta)
        self.facts_loaded = self._load_facts(settings.seed_dir / "facts.metta")
        self.rules_loaded = self._load_rules(settings.seed_dir / "rules.metta")
        self._add_engine_constants()

    @property
    def hyperon_version(self) -> str:
        return importlib.metadata.version("hyperon")

    # -- loading ---------------------------------------------------------------------------------

    def _load_facts(self, path: Path) -> int:
        return self._add_program(path)

    def _load_rules(self, path: Path) -> int:
        self._add_program(path)
        return len(set(_RULE_HEAD.findall(path.read_text(encoding="utf-8"))))

    def _add_program(self, path: Path) -> int:
        if not path.exists():
            raise EngineError(f"seed file missing: {path}")
        try:
            atoms = self._metta.parse_all(path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise EngineError(f"cannot parse {path.name}") from exc
        space = self._metta.space()
        for atom in atoms:
            space.add_atom(atom)
        return len(atoms)

    def _add_engine_constants(self) -> None:
        self._metta.run(f"(min-overlap-days {self._settings.min_overlap_days})")
