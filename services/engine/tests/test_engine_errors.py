"""EngineError and the fails-not-skips guarantee (requirements.md item 4, acceptance.md line 1).

Seams: MettaRouteEngine construction and eligible_builders on the real runtime, and the
pytest process itself when hyperon cannot be imported.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from app.config import Settings, get_settings
from app.engine.errors import EngineError
from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief

pytestmark = pytest.mark.runtime

ENGINE_DIR = Path(__file__).resolve().parent.parent


def _seed_copy(tmp_path: Path) -> Path:
    seed = tmp_path / "seed"
    shutil.copytree(get_settings().seed_dir, seed)
    return seed


def test_missing_seed_file_raises_engine_error(tmp_path: Path) -> None:
    seed = _seed_copy(tmp_path)
    (seed / "rules.metta").unlink()

    with pytest.raises(EngineError, match="seed file missing"):
        MettaRouteEngine(Settings(seed_dir=seed))


def test_unparseable_rule_output_raises_engine_error(
    tmp_path: Path, briefs: dict[str, VentureBrief]
) -> None:
    seed = _seed_copy(tmp_path)
    rules = seed / "rules.metta"
    # Override eligible-builder with an equation whose witness has the wrong shape.
    rules.write_text(
        rules.read_text(encoding="utf-8")
        + "\n(= (eligible-builder $brief $b $s) (eligible nobody python))\n",
        encoding="utf-8",
    )
    engine = MettaRouteEngine(Settings(seed_dir=seed))

    with pytest.raises(EngineError, match="malformed eligible witness"):
        engine.eligible_builders(briefs["brief-health-01"])


def test_rules_loaded_counts_only_rules_present_in_the_space(tmp_path: Path) -> None:
    seed = _seed_copy(tmp_path)
    text = (seed / "rules.metta").read_text(encoding="utf-8")
    # Cut the whole reuse-fit block but keep its name in a comment: the count must come from
    # what the space holds, not from the file's text.
    start = text.index("; ---- reuse-fit")
    end = text.index("; ---- route-gap")
    (seed / "rules.metta").write_text(
        text[:start] + "; (= (reuse-fit ...)) deliberately removed\n" + text[end:],
        encoding="utf-8",
    )

    assert MettaRouteEngine(Settings(seed_dir=seed)).rules_loaded == 6


def test_runtime_tests_fail_rather_than_skip_without_hyperon(tmp_path: Path) -> None:
    shadow = tmp_path / "shadow"
    (shadow / "hyperon").mkdir(parents=True)
    (shadow / "hyperon" / "__init__.py").write_text(
        "raise ImportError('simulated: hyperon is not installed')\n", encoding="utf-8"
    )
    env = {**os.environ, "PYTHONPATH": str(shadow)}

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-m",
            "runtime",
            "-p",
            "no:cacheprovider",
            "tests/test_health.py::test_hyperon_runtime_is_importable",
        ],
        cwd=ENGINE_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    output = result.stdout + result.stderr
    assert "skipped" not in output
    assert "simulated: hyperon is not installed" in output
