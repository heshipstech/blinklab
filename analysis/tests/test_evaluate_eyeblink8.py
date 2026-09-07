"""The Eyeblink8 tool's own summary, which had no test of its own.

Roadmap 10.10c1, ladder B8. Every function this tool calls is tested
next door in `test_blink_match.py`; the report it assembles from them
was reached by nothing, so a change to the published summary's own
wording or arithmetic could not go red anywhere. That is the same gap
`validation_report.py` had until roadmap 10.1f2.

The specific thing these tests exist for is that recall and precision
are counted proportions published as bare percentages. 83.6% from 408
annotated blinks and 83.6% from 8 would read identically, and only one
of them is a measurement worth acting on.
"""

from __future__ import annotations

import sys
from pathlib import Path

from blinklab.blink_match import MatchResult

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "analysis" / "tools"))

from evaluate_eyeblink8 import ClipResult, report  # noqa: E402


def clip(
    name: str, true_positives: int, false_negatives: int, invented: int
) -> ClipResult:
    return ClipResult(
        name=name,
        glasses=False,
        annotated=true_positives + false_negatives,
        detected=true_positives + invented,
        result=MatchResult(
            true_positives=true_positives,
            false_positives=invented,
            false_negatives=false_negatives,
            pairs=[],
        ),
        frames_measured=1000,
        frames_annotated=1000,
    )


class TestTheSummaryCarriesItsIntervals:
    def test_recall_and_precision_state_what_the_counts_support(
        self,
    ) -> None:
        # The published corpus, pooled: 341 of 408 found, 65 invented.
        # The interval beside it is the one the README publishes.
        text = report([clip("corpus", 341, 67, 65)])
        assert "341 of 408 found" in text
        assert "79.7 to 86.9" in text
        assert "80.1 to 87.2" in text

    def test_a_small_corpus_says_so_in_its_width(self) -> None:
        # The reason to print it at all. The same 83% over eight blinks
        # is a different claim from 83% over four hundred, and a bare
        # percentage hides which one a reader is looking at.
        wide = report([clip("tiny", 5, 1, 1)])
        narrow = report([clip("corpus", 341, 67, 65)])
        # Five of six found: 43.6 to 97.0. The same 83 percent over
        # four hundred is 79.7 to 86.9, and the difference between
        # those two sentences is the whole reason to print either.
        assert "43.6 to 97.0" in wide
        assert "79.7 to 86.9" in narrow

    def test_the_f1_carries_no_interval(self) -> None:
        # F1 is a harmonic mean of two proportions, not a count over a
        # count, so a Wilson interval on it would be arithmetic
        # borrowed from a distribution it does not have. Stated as a
        # test because the tempting thing is to put one on every
        # number in the block.
        lines = report([clip("corpus", 341, 67, 65)]).split("\n")
        f1_line = next(line for line in lines if "F1" in line)
        assert "interval" not in f1_line

    def test_it_still_reports_the_round_it_always_did(self) -> None:
        # A floor: if report() stopped producing its table, the
        # assertions above would go on passing against almost nothing.
        text = report([clip("corpus", 341, 67, 65)])
        lines = text.split("\n")
        assert "BLINK DETECTION vs Eyeblink8 ground truth" in text
        assert "Per clip" in text
        assert "Coverage" in text
        assert len(lines) > 10

    def test_no_clips_is_said_rather_than_summarised(self) -> None:
        assert report([]) == "No clips could be evaluated."
