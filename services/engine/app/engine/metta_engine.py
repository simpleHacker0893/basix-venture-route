"""MettaRouteEngine: the only adapter over the Hyperon runtime.

Every decision (eligibility, evidence, availability, mode/location fit) is a named MeTTa rule in
seed/rules.metta evaluated over the facts in seed/facts.metta. Python here loads the space,
adds the brief's facts for the duration of a query, runs the rule, and parses witnesses into
typed models. No Python code selects builders (AGENTS.md non-negotiable 1).
"""

from __future__ import annotations

import importlib.metadata
import re
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from hyperon import Atom, MeTTa

from app.config import Settings
from app.engine.atoms import (
    Term,
    atom_to_term,
    expect_list,
    expect_symbol,
    fact_atom,
    facts_text,
    term_to_text,
)
from app.engine.errors import EngineError
from app.engine.grounded import register_grounded_atoms
from app.models.brief import VentureBrief
from app.models.engine import (
    CohortInfo,
    EligibleTuple,
    EvidenceType,
    PartnerCandidate,
    ReasoningPath,
    RuleName,
)

_RULE_HEAD = re.compile(r"^\(=\s*\(([a-z][a-z0-9-]*)\b", re.MULTILINE)
_SYMBOL = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def _symbol(value: str, what: str) -> str:
    """Only kebab-case slugs may be spliced into a query (never raw user text)."""
    if not _SYMBOL.match(value):
        raise EngineError(f"{what} must be a kebab-case slug, got {value!r}")
    return value


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

    # -- public seams (D-19) ---------------------------------------------------------------------

    def eligible_builders(self, brief: VentureBrief) -> list[EligibleTuple]:
        """(builder, skill, evidence) tuples from `eligible-builder`, evidence folded to `both`."""
        with self._brief_in_space(brief):
            witnesses = self._query(f"!(eligible-builder {brief.id} $b $s)")
        folded: dict[tuple[str, str], _EligibleWitness] = {}
        for witness in witnesses:
            parsed = _EligibleWitness.parse(witness)
            key = (parsed.builder_id, parsed.skill_id)
            folded[key] = parsed if key not in folded else folded[key].merge(parsed)
        ordered = sorted(folded.values(), key=lambda w: (w.builder_id, w.skill_id))
        return [w.to_tuple() for w in ordered]

    def partner_candidates(
        self, brief: VentureBrief, builder_ids: list[str]
    ) -> list[PartnerCandidate]:
        """Partners reached from each selected builder by the four-hop `partner-fit` chain."""
        candidates: list[PartnerCandidate] = []
        with self._brief_in_space(brief):
            for builder_id in builder_ids:
                builder = _symbol(builder_id, "builder id")
                for witness in self._query(f"!(partner-fit {brief.id} {builder})"):
                    candidates.append(_parse_partner(witness, builder))
        return sorted(candidates, key=lambda c: (c.partner_id, c.builder_id))

    def cohort_of(self, builder_id: str) -> CohortInfo | None:
        """The builder's cohort and university, from `belongs-to` and `cohort-of` facts."""
        builder = _symbol(builder_id, "builder id")
        witnesses = self._query(
            f"!(match &self (, (belongs-to {builder} $c) (cohort-of $c $u))"
            f" (cohort $c $u ((belongs-to {builder} $c) (cohort-of $c $u))))"
        )
        if not witnesses:
            return None
        if len(witnesses) > 1:
            raise EngineError(f"{builder} belongs to more than one cohort")
        parts = expect_list(witnesses[0], "cohort witness")
        if len(parts) != 4 or parts[0] != "cohort":
            raise EngineError(f"malformed cohort witness: {witnesses[0]!r}")
        cohort_id = expect_symbol(parts[1], "cohort id")
        university_id = expect_symbol(parts[2], "university id")
        return CohortInfo(
            builder_id=builder,
            cohort_id=cohort_id,
            university_id=university_id,
            path=ReasoningPath(
                rule="cohort-of",
                facts=facts_text(parts[3], "cohort facts"),
                conclusion=f"{builder} belongs to {cohort_id} of {university_id}",
            ),
        )

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

    # -- querying --------------------------------------------------------------------------------

    def _query(self, program: str) -> list[Term]:
        """Run one `!(...)` expression and return its results as terms. EngineError on failure."""
        try:
            results = self._metta.run(program)
        except Exception as exc:
            raise EngineError(f"rule evaluation failed for {program}") from exc
        if len(results) != 1:
            raise EngineError(f"expected one result set for {program}, got {len(results)}")
        return [atom_to_term(atom) for atom in results[0]]

    @contextmanager
    def _brief_in_space(self, brief: VentureBrief) -> Iterator[None]:
        """Add the brief's facts for one query, then remove them. Serialised by a lock."""
        atoms = _brief_atoms(brief)
        space = self._metta.space()
        with self._lock:
            for atom in atoms:
                space.add_atom(atom)
            try:
                yield
            finally:
                for atom in atoms:
                    space.remove_atom(atom)


def _brief_atoms(brief: VentureBrief) -> list[Atom]:
    atoms = [fact_atom("brief-skill", brief.id, skill) for skill in brief.required_skills]
    atoms.append(fact_atom("brief-vertical", brief.id, brief.vertical))
    atoms.append(fact_atom("brief-mode", brief.id, brief.delivery_mode))
    atoms.append(
        fact_atom(
            "brief-window",
            brief.id,
            brief.availability_start.isoformat(),
            brief.availability_end.isoformat(),
        )
    )
    if brief.location_id:
        atoms.append(fact_atom("brief-location", brief.id, brief.location_id))
    if brief.prefer_reusable_ip:
        atoms.append(fact_atom("brief-prefers-ip", brief.id))
    return atoms


def _parse_partner(term: Term, builder_id: str) -> PartnerCandidate:
    """(partner p u c (facts...))"""
    parts = expect_list(term, "partner witness")
    if len(parts) != 5 or parts[0] != "partner":
        raise EngineError(f"malformed partner witness: {term!r}")
    partner_id = expect_symbol(parts[1], "partner id")
    university_id = expect_symbol(parts[2], "university id")
    cohort_id = expect_symbol(parts[3], "cohort id")
    return PartnerCandidate(
        partner_id=partner_id,
        builder_id=builder_id,
        university_id=university_id,
        cohort_id=cohort_id,
        path=ReasoningPath(
            rule=RuleName.PARTNER_FIT,
            facts=facts_text(parts[4], "partner-fit facts"),
            conclusion=(
                f"{partner_id} fits via {university_id} and {cohort_id} of {builder_id}"
            ),
        ),
    )


class _EligibleWitness:
    """(eligible b s ev (verified facts) (mode facts) (avail facts) (account fact))"""

    def __init__(
        self,
        builder_id: str,
        skill_id: str,
        evidence: EvidenceType,
        verified_facts: list[str],
        mode_facts: list[str],
        avail_facts: list[str],
        account_fact: str,
    ) -> None:
        self.builder_id = builder_id
        self.skill_id = skill_id
        self.evidence = evidence
        self.verified_facts = verified_facts
        self.mode_facts = mode_facts
        self.avail_facts = avail_facts
        self.account_fact = account_fact

    @classmethod
    def parse(cls, term: Term) -> _EligibleWitness:
        parts = expect_list(term, "eligible witness")
        if len(parts) != 8 or parts[0] != "eligible":
            raise EngineError(f"malformed eligible witness: {term!r}")
        evidence_symbol = expect_symbol(parts[3], "evidence type")
        evidence: EvidenceType
        if evidence_symbol == "credential":
            evidence = "credential"
        elif evidence_symbol == "project":
            evidence = "project"
        else:
            raise EngineError(f"unknown evidence type {evidence_symbol!r}")
        return cls(
            builder_id=expect_symbol(parts[1], "builder id"),
            skill_id=expect_symbol(parts[2], "skill id"),
            evidence=evidence,
            verified_facts=facts_text(parts[4], "verified-for-skill facts"),
            mode_facts=facts_text(parts[5], "mode-compatible facts"),
            avail_facts=facts_text(parts[6], "available-for-brief facts"),
            account_fact=term_to_text(parts[7]),
        )

    def merge(self, other: _EligibleWitness) -> _EligibleWitness:
        """Same builder and skill seen again: union the facts, fold evidence to `both`."""
        evidence: EvidenceType = (
            self.evidence if self.evidence == other.evidence else "both"
        )
        return _EligibleWitness(
            builder_id=self.builder_id,
            skill_id=self.skill_id,
            evidence=evidence,
            verified_facts=_union(self.verified_facts, other.verified_facts),
            mode_facts=_union(self.mode_facts, other.mode_facts),
            avail_facts=_union(self.avail_facts, other.avail_facts),
            account_fact=self.account_fact,
        )

    def to_tuple(self) -> EligibleTuple:
        facts = [*self.verified_facts, *self.mode_facts, *self.avail_facts, self.account_fact]
        return EligibleTuple(
            builder_id=self.builder_id,
            skill_id=self.skill_id,
            evidence=self.evidence,
            path=ReasoningPath(
                rule=RuleName.ELIGIBLE_BUILDER,
                facts=facts,
                conclusion=(
                    f"{self.builder_id} is eligible for {self.skill_id} "
                    f"with {self.evidence} evidence"
                ),
            ),
        )


def _union(first: list[str], second: list[str]) -> list[str]:
    return list(dict.fromkeys([*first, *second]))
