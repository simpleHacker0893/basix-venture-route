"""Python-grounded atoms registered into the MeTTa space.

Only arithmetic helpers live here. The rules that combine predicates are MeTTa
(`seed/rules.metta`), never Python (AGENTS.md non-negotiable 1).
"""

from datetime import date

from hyperon import Atom, MeTTa, OperationAtom, ValueAtom

from app.engine.errors import EngineError


def _iso_date(atom: Atom) -> date:
    try:
        return date.fromisoformat(atom.get_name())
    except (AttributeError, ValueError) as exc:
        raise EngineError(f"expected an ISO date symbol, got {atom!r}") from exc


def overlap_days(*atoms: Atom) -> list[Atom]:
    """(overlap-days start1 end1 start2 end2) -> inclusive number of shared calendar days, >= 0."""
    if len(atoms) != 4:
        raise EngineError(f"overlap-days expects 4 date symbols, got {len(atoms)}")
    start1, end1, start2, end2 = (_iso_date(atom) for atom in atoms)
    shared = (min(end1, end2) - max(start1, start2)).days + 1
    return [ValueAtom(max(shared, 0))]


def register_grounded_atoms(metta: MeTTa) -> None:
    metta.register_atom("overlap-days", OperationAtom("overlap-days", overlap_days, unwrap=False))
