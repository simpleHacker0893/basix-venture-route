"""MettaRouteEngine: the only adapter over the Hyperon runtime.

Every decision (eligibility, evidence, availability, mode/location fit, reuse fit, partner fit,
gaps) is a named MeTTa rule in seed/rules.metta evaluated over the facts in seed/facts.metta.
Python here loads the space, adds the brief's facts for the duration of a query, runs the rule,
and parses witnesses into typed models. No Python code selects builders (AGENTS.md rule 1).
"""

from __future__ import annotations

import importlib.metadata
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import cast, get_args

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
from app.models.brief import SLUG, VentureBrief
from app.models.engine import (
    METTA_RULE_ARITY,
    CohortInfo,
    EligibleTuple,
    EvidenceType,
    Gap,
    GapCategory,
    LookupName,
    PartnerCandidate,
    ReasoningPath,
    ReuseCandidate,
    RuleName,
)

_WITNESS_EVIDENCE: frozenset[str] = frozenset({"credential", "project"})
_GAP_CATEGORIES: frozenset[str] = frozenset(get_args(GapCategory))


def _symbol(value: str, what: str) -> str:
    """Only kebab-case slugs may be spliced into a query (never raw user text)."""
    if not SLUG.match(value):
        raise EngineError(f"{what} must be a kebab-case slug, got {value!r}")
    return value


class MettaRouteEngine:
    """Owns the MeTTa instance. All decisions come from the named rules in rules.metta."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self.projected_rows = 0
        self._metta, self.facts_loaded = self._build_runtime()
        self.rules_loaded = self._count_named_rules_in_space()

    def _build_runtime(self) -> tuple[MeTTa, int]:
        """A fresh Hyperon runtime holding the seed facts, the rules and the overlap constant."""
        try:
            metta = MeTTa()
        except Exception as exc:  # pragma: no cover - only when the native runtime is broken
            raise EngineError("Hyperon runtime failed to start") from exc
        register_grounded_atoms(metta)
        facts_loaded = self._add_program(metta, self._settings.seed_dir / "facts.metta")
        self._add_program(metta, self._settings.seed_dir / "rules.metta")
        metta.run(f"(min-overlap-days {self._settings.min_overlap_days})")
        return metta, facts_loaded

    def replace_space(self, program: str) -> int:
        """Full rebuild (D-15): seed files plus `program` (marketplace facts in seed syntax) in a
        fresh runtime. Build and swap both run under the engine lock (spec #35 §Projection), so
        rebuilds are serialised in call order and a query never straddles two runtimes.
        Returns the number of projected atoms; `facts_loaded` keeps counting seed atoms."""
        with self._lock:
            if not program.strip() and self.projected_rows == 0:
                return 0  # already seed-only: nothing to rebuild
            metta, facts_loaded = self._build_runtime()
            projected = self._add_text(metta, program) if program.strip() else 0
            self._metta = metta
            self.facts_loaded = facts_loaded
            self.projected_rows = projected
        return projected

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

    def reuse_candidates(self, brief: VentureBrief) -> list[ReuseCandidate]:
        """Licensable assets in the brief's vertical that demonstrate a required skill."""
        with self._brief_in_space(brief):
            witnesses = self._query(f"!(reuse-fit {brief.id} $asset)")
        by_asset: dict[str, _ReuseWitness] = {}
        for witness in witnesses:
            parsed = _ReuseWitness.parse(witness)
            key = parsed.asset_id
            by_asset[key] = parsed if key not in by_asset else by_asset[key].merge(parsed)
        return [by_asset[key].to_candidate() for key in sorted(by_asset)]

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
        """The builder's cohort and university via the `cohort-membership` lookup in rules.metta."""
        builder = _symbol(builder_id, "builder id")
        witnesses = self._query(f"!(cohort-membership {builder})")
        if not witnesses:
            return None
        if len(witnesses) > 1:
            raise EngineError(f"{builder} belongs to more than one cohort")
        return _parse_cohort(witnesses[0], builder)

    def day_rates(self, builder_ids: list[str]) -> dict[str, int]:
        """USD per day per builder from `day-rate` atoms (D-24); every id must have one."""
        rates: dict[str, int] = {}
        for builder_id in builder_ids:
            builder = _symbol(builder_id, "builder id")
            witnesses = self._query(f"!(match &self (day-rate {builder} $usd) $usd)")
            if len(witnesses) != 1 or not isinstance(witnesses[0], int):
                raise EngineError(f"expected one integer day-rate fact for {builder}")
            rates[builder] = witnesses[0]
        return rates

    def known_locations(self) -> frozenset[str]:
        """Every location slug a `located-in` fact names. Symbols share one namespace with the
        builders, so a user-entered builder slug must not collide with a location either."""
        found: set[str] = set()
        for witness in self._query("!(match &self (located-in $b $l) ($l))"):
            for part in expect_list(witness, "location"):
                found.add(expect_symbol(part, "location"))
        return frozenset(found)

    def known_entities(self) -> frozenset[str]:
        """Every builder, cohort, university, partner and asset id in the space.

        Used by the explanation boundary to spot an LLM summary naming an entity the route
        does not carry. Read from graph predicates, no rule involved.
        """
        queries = (
            "!(match &self (belongs-to $b $c) ($b $c))",
            "!(match &self (cohort-of $c $u) ($c $u))",
            "!(match &self (supports-vertical $p $v) ($p))",
            "!(match &self (vertical $x $v) ($x))",
        )
        found: set[str] = set()
        for query in queries:
            for witness in self._query(query):
                found.update(
                    expect_symbol(part, "entity id") for part in expect_list(witness, "ids")
                )
        return frozenset(found)

    def cohorts(self) -> frozenset[str]:
        """Every cohort id in the space, from `cohort-of` facts. A profile may only name one of
        these (Sprint 003 spec #35 §Marketplace API)."""
        found: set[str] = set()
        for witness in self._query("!(match &self (cohort-of $c $u) ($c))"):
            found.update(expect_symbol(part, "cohort id") for part in expect_list(witness, "ids"))
        return frozenset(found)

    def gaps(self, brief: VentureBrief) -> list[Gap]:
        """skill / availability / mode / location gaps per required skill from `route-gap`."""
        with self._brief_in_space(brief):
            witnesses = self._query(f"!(route-gap {brief.id} $s $category)")
        gaps = [_parse_gap(witness, brief) for witness in witnesses]
        return sorted(gaps, key=lambda g: (g.affected[0], g.category))

    # -- loading ---------------------------------------------------------------------------------

    def _add_program(self, metta: MeTTa, path: Path) -> int:
        """Parse a seed file and add every atom to the space; returns the atom count."""
        if not path.exists():
            raise EngineError(f"seed file missing: {path}")
        try:
            return self._add_text(metta, path.read_text(encoding="utf-8"))
        except EngineError as exc:
            raise EngineError(f"cannot parse {path.name}") from exc

    @staticmethod
    def _add_text(metta: MeTTa, text: str) -> int:
        try:
            atoms = metta.parse_all(text)
        except Exception as exc:
            raise EngineError("cannot parse facts") from exc
        space = metta.space()
        for atom in atoms:
            space.add_atom(atom)
        return len(atoms)

    def _count_named_rules_in_space(self) -> int:
        """Ask the space which of the seven named rules have at least one equation loaded."""
        loaded = 0
        for rule, arity in METTA_RULE_ARITY.items():
            args = " ".join(f"$a{i}" for i in range(arity))
            if self._query(f"!(match &self (= ({rule} {args}) $body) {rule})"):
                loaded += 1
        return loaded

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
        with self._lock:
            # Read the runtime only under the lock: replace_space() swaps it there, so the brief
            # atoms and the query that follows always hit the same instance.
            space = self._metta.space()
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


# -- witness parsers (parsing only; no selection happens here) ---------------------------------


def _witness_parts(term: Term, head: str, size: int) -> list[Term]:
    parts = expect_list(term, f"{head} witness")
    if len(parts) != size or parts[0] != head:
        raise EngineError(f"malformed {head} witness: {term!r}")
    return parts


def _parse_partner(term: Term, builder_id: str) -> PartnerCandidate:
    """(partner p u c (facts...))"""
    parts = _witness_parts(term, "partner", 5)
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
            conclusion=f"{partner_id} fits via {university_id} and {cohort_id} of {builder_id}",
        ),
    )


def _parse_cohort(term: Term, builder_id: str) -> CohortInfo:
    """(cohort c u (facts...))"""
    parts = _witness_parts(term, "cohort", 4)
    cohort_id = expect_symbol(parts[1], "cohort id")
    university_id = expect_symbol(parts[2], "university id")
    return CohortInfo(
        builder_id=builder_id,
        cohort_id=cohort_id,
        university_id=university_id,
        path=ReasoningPath(
            rule=LookupName.COHORT_OF,
            facts=facts_text(parts[3], "cohort facts"),
            conclusion=f"{builder_id} belongs to {cohort_id} of {university_id}",
        ),
    )


class _ReuseWitness:
    """(reuse asset s (facts...)); one witness per (asset, required skill)."""

    def __init__(self, asset_id: str, skill_ids: list[str], facts: list[str]) -> None:
        self.asset_id = asset_id
        self.skill_ids = skill_ids
        self.facts = facts

    @classmethod
    def parse(cls, term: Term) -> _ReuseWitness:
        parts = _witness_parts(term, "reuse", 4)
        return cls(
            asset_id=expect_symbol(parts[1], "asset id"),
            skill_ids=[expect_symbol(parts[2], "skill id")],
            facts=facts_text(parts[3], "reuse-fit facts"),
        )

    def merge(self, other: _ReuseWitness) -> _ReuseWitness:
        return _ReuseWitness(
            asset_id=self.asset_id,
            skill_ids=sorted(set(self.skill_ids) | set(other.skill_ids)),
            facts=_union(self.facts, other.facts),
        )

    def to_candidate(self) -> ReuseCandidate:
        return ReuseCandidate(
            asset_id=self.asset_id,
            skill_ids=self.skill_ids,
            path=ReasoningPath(
                rule=RuleName.REUSE_FIT,
                facts=self.facts,
                conclusion=(
                    f"{self.asset_id} is licensable in the brief's vertical and demonstrates "
                    + ", ".join(self.skill_ids)
                ),
            ),
        )


_GAP_STATEMENTS: dict[str, str] = {
    "skill": "No confirmed credential or completed project proves {skill} for any builder.",
    "availability": (
        "Builders verified for {skill} exist, but none overlaps the brief window "
        "{start} to {end} by at least the minimum overlap."
    ),
    "mode": "Builders verified for {skill} are available, but none supports {mode} delivery.",
    "location": (
        "Builders verified for {skill} are available and support on-site delivery, "
        "but none is located in {location}."
    ),
}

_GAP_NEXT_ACTIONS: dict[str, list[str]] = {
    "skill": [
        "Ask BASIX to confirm a credential or project for {skill}.",
        "Remove {skill} from the brief or replace it with a related skill.",
    ],
    "availability": [
        "Widen the availability window.",
        "Ask a verified {skill} builder to open availability inside the window.",
    ],
    "mode": [
        "Change the delivery mode.",
        "Ask a verified {skill} builder to support {mode} delivery.",
    ],
    "location": [
        "Change the location or switch to hybrid delivery.",
        "Ask a verified {skill} builder located in {location} to support on-site delivery.",
    ],
}


def _parse_gap(term: Term, brief: VentureBrief) -> Gap:
    """(gap category s)"""
    parts = _witness_parts(term, "gap", 3)
    category_symbol = expect_symbol(parts[1], "gap category")
    if category_symbol not in _GAP_CATEGORIES or category_symbol not in _GAP_STATEMENTS:
        raise EngineError(f"unknown gap category {category_symbol!r}")
    category = cast(GapCategory, category_symbol)
    skill_id = expect_symbol(parts[2], "skill id")
    fields = {
        "skill": skill_id,
        "start": brief.availability_start.isoformat(),
        "end": brief.availability_end.isoformat(),
        "mode": brief.delivery_mode,
        "location": brief.location or "",
    }
    return Gap(
        category=category,
        statement=_GAP_STATEMENTS[category].format(**fields),
        affected=[skill_id],
        next_actions=[action.format(**fields) for action in _GAP_NEXT_ACTIONS[category]],
        rule=RuleName.ROUTE_GAP,
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
        parts = _witness_parts(term, "eligible", 8)
        evidence_symbol = expect_symbol(parts[3], "evidence type")
        if evidence_symbol not in _WITNESS_EVIDENCE:
            raise EngineError(f"unknown evidence type {evidence_symbol!r}")
        return cls(
            builder_id=expect_symbol(parts[1], "builder id"),
            skill_id=expect_symbol(parts[2], "skill id"),
            evidence=cast(EvidenceType, evidence_symbol),
            verified_facts=facts_text(parts[4], "verified-for-skill facts"),
            mode_facts=facts_text(parts[5], "mode-compatible facts"),
            avail_facts=facts_text(parts[6], "available-for-brief facts"),
            account_fact=term_to_text(parts[7]),
        )

    def merge(self, other: _EligibleWitness) -> _EligibleWitness:
        """Same builder and skill seen again: union the facts, fold evidence to `both`."""
        evidence: EvidenceType = self.evidence if self.evidence == other.evidence else "both"
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
