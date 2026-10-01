"""Check SUBMISSION.md against the BASIX hackathon form.

Usage (from services/engine):
    uv run python scripts/check_submission.py                 # checks ../../SUBMISSION.md
    uv run python scripts/check_submission.py path/to/file.md # checks another file
    uv run python scripts/check_submission.py --final         # also rejects TBD placeholders

Format: one `## <Field name>` heading per form field, the value below it. A field that is not
ready yet holds the single token `TBD`. Exit 0 when every rule passes, 1 otherwise.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

PLACEHOLDER = "TBD"
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PATH = REPO_ROOT / "SUBMISSION.md"

REQUIRED = ("Project title", "Tagline", "Description", "GitHub repository", "Track")
OPTIONAL = ("Live demo", "Slide deck", "Demo video")
FIELDS = ("Project title", "Tagline", "Description", "GitHub repository", "Live demo",
          "Slide deck", "Track", "Demo video")  # fmt: skip
URL_FIELDS = ("GitHub repository", "Live demo", "Slide deck")
FINAL_FIELDS = ("Live demo", "Slide deck", "Demo video")
DESCRIPTION_MIN, DESCRIPTION_MAX = 120, 4000
TRACK = "MeTTa"

_HEADING = re.compile(r"^## (.+?)\s*$")


@dataclass
class Result:
    errors: list[str] = field(default_factory=list)
    description_length: int | None = None


def parse(text: str) -> dict[str, str]:
    """Split the document into {field name: value} by `## ` headings."""
    sections: dict[str, list[str]] = {}
    current: list[str] | None = None
    for line in text.splitlines():
        match = _HEADING.match(line)
        if match:
            current = sections.setdefault(match.group(1), [])
        elif current is not None:
            current.append(line)
    return {name: "\n".join(lines).strip() for name, lines in sections.items()}


def check(text: str, *, final: bool = False) -> Result:
    result = Result()
    values = parse(text)
    for name in FIELDS:
        if name not in values:
            result.errors.append(f"{name}: missing (add a '## {name}' section)")
    present = {n: v for n, v in values.items() if n in FIELDS}

    for name in REQUIRED:
        if name in present and not present[name]:
            result.errors.append(f"{name}: required, but empty")

    tagline = present.get("Tagline")
    if tagline and len(tagline.splitlines()) != 1:
        result.errors.append("Tagline: must be one line")

    description = present.get("Description")
    if description:
        result.description_length = len(description)
        if not DESCRIPTION_MIN <= len(description) <= DESCRIPTION_MAX:
            result.errors.append(
                f"Description: {len(description)} characters, "
                f"must be {DESCRIPTION_MIN} to {DESCRIPTION_MAX}"
            )

    for name in URL_FIELDS:
        value = present.get(name)
        if not value or (name in OPTIONAL and value == PLACEHOLDER):
            continue
        if not value.startswith("https://") or len(value.split()) != 1:
            result.errors.append(f"{name}: must be a single https URL, got '{value}'")

    track = present.get("Track")
    if track and track != TRACK:
        result.errors.append(f"Track: must be '{TRACK}', got '{track}'")

    if final:
        for name in FINAL_FIELDS:
            if name in present and present[name] in ("", PLACEHOLDER):
                result.errors.append(f"{name}: still {PLACEHOLDER}; --final needs the real value")
    return result


def main(argv: list[str]) -> int:
    final = "--final" in argv
    paths = [a for a in argv if not a.startswith("--")]
    path = Path(paths[0]) if paths else DEFAULT_PATH
    if not path.exists():
        print(f"{path} not found", file=sys.stderr)
        return 1
    result = check(path.read_text(encoding="utf-8"), final=final)
    if result.description_length is not None:
        print(f"Description: {result.description_length} characters")
    if result.errors:
        for error in result.errors:
            print(error, file=sys.stderr)
        print(f"{path} has {len(result.errors)} problem(s)", file=sys.stderr)
        return 1
    print(f"{path} is ready" + (" for submission" if final else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
