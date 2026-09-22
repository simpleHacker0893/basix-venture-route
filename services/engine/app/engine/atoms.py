"""Atom <-> Python conversion. Parsing only; no selection logic lives here."""

from __future__ import annotations

from hyperon import Atom, AtomKind, E, S

from app.engine.errors import EngineError

type Term = str | int | float | bool | list["Term"]


def atom_to_term(atom: Atom) -> Term:
    """Symbol -> str, grounded -> value, expression -> list. Variables are an error."""
    kind = atom.get_metatype()
    if kind == AtomKind.SYMBOL:
        return str(atom.get_name())
    if kind == AtomKind.EXPR:
        return [atom_to_term(child) for child in atom.get_children()]
    if kind == AtomKind.GROUNDED:
        value = atom.get_object().value
        if isinstance(value, bool | int | float | str):
            return value
        raise EngineError(f"unsupported grounded value {value!r}")
    raise EngineError(f"unexpected unbound variable in runtime output: {atom!r}")


def term_to_text(term: Term) -> str:
    """Render a term as written in the seed files, e.g. (earned amina-otieno cred-py-201)."""
    if isinstance(term, list):
        return "(" + " ".join(term_to_text(child) for child in term) + ")"
    if isinstance(term, str):
        return term
    return repr(term)


def expect_list(term: Term, what: str) -> list[Term]:
    if not isinstance(term, list):
        raise EngineError(f"expected {what} to be an expression, got {term!r}")
    return term


def expect_symbol(term: Term, what: str) -> str:
    if not isinstance(term, str):
        raise EngineError(f"expected {what} to be a symbol, got {term!r}")
    return term


def fact_atom(*symbols: str) -> Atom:
    """Build a flat fact expression from symbols, e.g. fact_atom('brief-skill', id, 'python')."""
    return E(*(S(symbol) for symbol in symbols))


def facts_text(facts: Term, what: str) -> list[str]:
    """A witness fact list -> list of fact strings in match order."""
    return [term_to_text(fact) for fact in expect_list(facts, what)]
