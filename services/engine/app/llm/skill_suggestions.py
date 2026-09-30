"""Résumé skill labels → `SkillSuggestion` chips (D-50; #95).

The model only proposes labels. This module decides what the builder sees: a label that names one
of the nine vocabulary skills (by display name or id, ignoring case, spaces and punctuation)
becomes that skill's display name with its `skillId`; any other label is kept trimmed as free
text if it fits a chip (≤40 chars). Duplicates are dropped case-insensitively and the list is
capped at 20. Suggestions are display-only: nothing here reaches MeTTa.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import cast

from app.marketplace.schemas import SkillSuggestion
from app.models.brief import SkillId

MAX_SUGGESTIONS = 20
MAX_LABEL_LENGTH = 40


def _key(label: str) -> str:
    return "".join(char for char in label.casefold() if char.isalnum())


def to_suggestions(labels: Iterable[str], vocabulary: Mapping[str, str]) -> list[SkillSuggestion]:
    """`vocabulary` is skill id → display name (the seeded `skills` table)."""
    by_key: dict[str, str] = {}
    for skill_id, name in vocabulary.items():
        by_key[_key(skill_id)] = skill_id
        by_key[_key(name)] = skill_id

    suggestions: list[SkillSuggestion] = []
    seen: set[str] = set()
    for raw in labels:
        label = raw.strip()
        if not label:
            continue
        matched = by_key.get(_key(label))
        if matched is not None:
            label = vocabulary[matched]
        elif len(label) > MAX_LABEL_LENGTH:
            continue
        identity = label.casefold()
        if identity in seen:
            continue
        seen.add(identity)
        suggestions.append(SkillSuggestion(label=label, skill_id=cast(SkillId | None, matched)))
        if len(suggestions) == MAX_SUGGESTIONS:
            break
    return suggestions
