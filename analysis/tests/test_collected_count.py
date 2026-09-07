"""The published Python count is the runner's number, not a grep.

Roadmap 10.1g2. Every document says "N Python tests ... all green",
which reads as a claim about a run. The number came from a grep for
``def test_`` in ``tools/resultGuard.mjs``, and a grep counts test
FUNCTIONS. pytest expands one parametrised function into one test per
case, so the grep read 446 where the runner collected 488, and the
sentence described a run that never happened.

A grep cannot know the expansion without evaluating Python. So the
number lives in a committed file instead: the JavaScript guard reads
that file, and this test holds the file to what pytest itself
collects. Neither side can drift on its own.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ANALYSIS_ROOT = Path(__file__).resolve().parents[1]
COLLECTED_FILE = ANALYSIS_ROOT / "collected-tests.txt"


def committed_count() -> int:
    """The number the committed file states, ignoring its comments."""
    lines = [
        line.strip()
        for line in COLLECTED_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert len(lines) == 1, (
        f"{COLLECTED_FILE.name} must hold exactly one number, "
        f"found {len(lines)} non-comment lines"
    )
    return int(lines[0])


def collected_count() -> int:
    """What pytest itself collects in this folder, asked directly."""
    # A subprocess rather than this session's own count: the outer run
    # may have been filtered with -k or given one file, and a partial
    # count would quietly pass while the published figure was wrong.
    # --collect-only executes no test body, so this cannot recurse.
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "--collect-only",
            "-q",
            "-p",
            "no:cacheprovider",
        ],
        cwd=ANALYSIS_ROOT,
        capture_output=True,
        text=True,
        check=True,
        timeout=600,
    )
    match = re.search(r"(\d+) tests? collected", result.stdout)
    assert match is not None, (
        "pytest --collect-only printed no collected count:\n"
        f"{result.stdout[-2000:]}"
    )
    return int(match.group(1))


def test_the_committed_count_is_what_pytest_collects() -> None:
    """The file the guard reads says what the runner says."""
    assert committed_count() == collected_count()


def test_the_file_holds_one_number_and_explains_itself() -> None:
    """A bare integer with no account of itself is a stale magnet."""
    text = COLLECTED_FILE.read_text(encoding="utf-8")
    assert text.startswith("#"), "the file must open with its reason"
    assert "10.1g2" in text, "the file must name the row that made it"
    assert committed_count() > 0
