"""The border between the two languages, asserted from both sides.

The browser writes a CSV whose column list lives in TypeScript, at
src/core/csv.ts. Everything in this folder reads those files. Nothing
enforces that the two sides agree, and a disagreement would be
silent: Python would read a column that no longer exists, or quietly
miss one that was added, and the first symptom would be a wrong
number in an analysis nobody re-derived by hand.

So the contract is asserted here, in the language that consumes it,
against the TypeScript source that produces it.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CSV_SOURCE = REPO_ROOT / "src" / "core" / "csv.ts"

# What the analysis track believes it is reading. Written out rather
# than derived, so that a change on the TypeScript side has to be
# acknowledged here by a human editing this list.
EXPECTED_COLUMNS = [
    "timestampMs",
    "faceDetected",
    "fps",
    "apertureMm",
    "baselineMm",
    "shutBaselineMm",
    "blinkRatePerMin",
    "lastBlinkDurationMs",
    "lastBlinkAmplitudeMm",
    "lastBlinkPeakVelocityMmPerS",
    "perclos",
    "longClosureCount",
    "fixationCount",
    "fixationMedianMs",
    "fixating",
    "onScreen",
    "baselineOverResting",
]


def declared_columns() -> list[str]:
    """Read CSV_COLUMNS out of the TypeScript source."""
    source = CSV_SOURCE.read_text(encoding="utf-8")
    match = re.search(
        r"export const CSV_COLUMNS = \[(.*?)\] as const", source, re.S
    )
    assert match is not None, f"CSV_COLUMNS not found in {CSV_SOURCE}"
    return re.findall(r'"([^"]+)"', match.group(1))


def test_the_typescript_source_is_where_we_think_it_is() -> None:
    assert CSV_SOURCE.exists(), f"missing {CSV_SOURCE}"


def test_columns_match_between_the_languages() -> None:
    assert declared_columns() == EXPECTED_COLUMNS


RULER_FIT_SOURCE = REPO_ROOT / "src" / "core" / "rulerFit.ts"


def test_the_ruler_fit_ceiling_matches_between_the_languages() -> None:
    """One check, two implementations, one number.

    The browser judges the ratio live (src/core/rulerFit.ts) and the
    round's tool judges it from the file (validation_checks.py). If
    the two ceilings ever drift apart, a session could be told it
    fits on the page and be flagged in the published table, and the
    drift would be silent, so this reads the TypeScript constant out
    of its source the same way declared_columns() reads the columns.
    """
    from blinklab.validation_checks import BASELINE_OVER_RESTING_CEILING

    source = RULER_FIT_SOURCE.read_text(encoding="utf-8")
    match = re.search(
        r"export const BASELINE_OVER_RESTING_CEILING = ([0-9.]+);", source
    )
    assert match is not None, f"ceiling not found in {RULER_FIT_SOURCE}"
    assert float(match.group(1)) == BASELINE_OVER_RESTING_CEILING


def test_the_timestamp_column_comes_first() -> None:
    """Row order depends on it, and every plot will sort by it."""
    assert declared_columns()[0] == "timestampMs"
