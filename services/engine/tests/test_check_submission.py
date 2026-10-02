"""SUBMISSION.md check: one test per rule (fields, tagline, description, https, track, --final)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from check_submission import PLACEHOLDER, check, main  # noqa: E402

FIELDS = {
    "Project title": "Venture Route",
    "Tagline": "One line a judge can repeat back.",
    "Description": "d" * 200,
    "GitHub repository": "https://github.com/simpleHacker0893/basix-venture-route",
    "Live demo": PLACEHOLDER,
    "Slide deck": PLACEHOLDER,
    "Track": "MeTTa",
    "Demo video": PLACEHOLDER,
}
FINAL_VALUES = {
    "Live demo": "https://venture-route.example.com",
    "Slide deck": "https://canva.link/venture-route",
    "Demo video": "venture-route-demo.mp4",
}


def doc(**overrides: str | None) -> str:
    """Build a SUBMISSION.md; keys use underscores for spaces, None drops the field."""
    parts = ["# Submission", ""]
    for name, value in FIELDS.items():
        key = name.replace(" ", "_")
        text: str | None = overrides.get(key, value)
        if text is None:
            continue
        parts += [f"## {name}", "", text, ""]
    return "\n".join(parts)


def errors(text: str, final: bool = False) -> list[str]:
    return check(text, final=final).errors


def test_valid_document_passes_and_reports_description_length() -> None:
    result = check(doc())
    assert result.errors == []
    assert result.description_length == 200


@pytest.mark.parametrize("name", list(FIELDS))
def test_missing_field_fails(name: str) -> None:
    out = errors(doc(**{name.replace(" ", "_"): None}))
    assert any(name in e and "missing" in e for e in out)


def test_empty_required_field_fails() -> None:
    assert any("Project title" in e for e in errors(doc(Project_title="")))


def test_two_line_tagline_fails() -> None:
    out = errors(doc(Tagline="First line.\nSecond line."))
    assert any("Tagline" in e and "one line" in e for e in out)


@pytest.mark.parametrize(("length", "ok"), [(119, False), (120, True), (4000, True), (4001, False)])
def test_description_bounds(length: int, ok: bool) -> None:
    out = errors(doc(Description="x" * length))
    assert (not any("Description" in e for e in out)) is ok


def test_http_repository_fails() -> None:
    out = errors(doc(GitHub_repository="http://github.com/simpleHacker0893/basix-venture-route"))
    assert any("GitHub repository" in e and "https" in e for e in out)


def test_http_optional_url_fails_but_placeholder_is_fine_by_default() -> None:
    assert any("Live demo" in e for e in errors(doc(Live_demo="http://example.com")))
    assert errors(doc()) == []


def test_wrong_track_fails() -> None:
    out = errors(doc(Track="DeFi"))
    assert any("Track" in e and "MeTTa" in e for e in out)


def test_final_rejects_placeholders() -> None:
    out = errors(doc(), final=True)
    for name in ("Live demo", "Slide deck", "Demo video"):
        assert any(name in e and PLACEHOLDER in e for e in out)


def test_final_passes_with_real_values() -> None:
    overrides = {k.replace(" ", "_"): v for k, v in FINAL_VALUES.items()}
    assert errors(doc(**overrides), final=True) == []


def test_main_exit_codes_and_output(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    good = tmp_path / "SUBMISSION.md"
    good.write_text(doc(), encoding="utf-8")
    assert main([str(good)]) == 0
    assert "Description: 200 characters" in capsys.readouterr().out
    assert main([str(good), "--final"]) == 1
    assert PLACEHOLDER in capsys.readouterr().err
    assert main([str(tmp_path / "nope.md")]) == 1
