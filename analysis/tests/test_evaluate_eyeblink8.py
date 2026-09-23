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
from dataclasses import replace
from pathlib import Path

from blinklab.blink_log import BLINK_COLUMNS, BlinkLog
from blinklab.blink_match import MatchResult
from blinklab.eyeblink8 import Annotation

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "analysis" / "tools"))

from evaluate_eyeblink8 import (  # noqa: E402
    ClipResult,
    Refusal,
    clip_refusal,
    collect,
    coverage_refusal,
    exit_code,
    report,
)


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


class TestTheDelegateLine:
    """Roadmap 13.5: the run header names the delegate it was asked for.

    Named REQUESTED on purpose. The vendored API reports no executed
    delegate, so a header claiming "ran on GPU" would state an
    observation nobody made; the line carries the request the run's
    own blink logs recorded, and for logs that predate the
    delegate_requested key it says the only honest thing there is.
    """

    def test_a_run_that_predates_the_probe_says_so(self) -> None:
        # The committed 2026-09-09 run has no delegate_requested key
        # anywhere, and its header must not read as a measurement.
        text = report([clip("corpus", 341, 67, 65)])
        assert "Delegate   unknown, probe added after this run" in text

    def test_a_recorded_request_is_printed_as_a_request(self) -> None:
        recorded = replace(
            clip("corpus", 341, 67, 65), delegate_requested="GPU"
        )
        text = report([recorded])
        assert (
            "Delegate   GPU requested; executed delegate unobservable" in text
        )

    def test_clips_that_disagree_are_reported_as_mixed(self) -> None:
        # A run half measured before the key existed and half after
        # is not a run with one delegate story, and averaging the two
        # into either would be the dilution defect wearing new keys.
        a = replace(clip("one", 30, 5, 2), delegate_requested="GPU")
        b = clip("two", 40, 4, 3)
        text = report([a, b])
        assert (
            "Delegate   mixed (GPU, unknown); executed delegate unobservable"
            in text
        )

    def test_the_line_sits_in_the_header_above_the_recall(self) -> None:
        lines = report([clip("corpus", 341, 67, 65)]).split("\n")
        delegate_at = next(
            i for i, line in enumerate(lines) if line.startswith("  Delegate")
        )
        recall_at = next(
            i for i, line in enumerate(lines) if line.startswith("  Recall")
        )
        assert delegate_at < recall_at


def _log(
    mode: str = "stepped", frames_measured: str | None = "1000"
) -> BlinkLog:
    metadata = {"measurement_mode": mode}
    if frames_measured is not None:
        metadata["frames_measured"] = frames_measured
    return BlinkLog(name="clip", blinks=[], metadata=metadata)


def _annotation(frame_count: int = 1000, glasses: bool = False) -> Annotation:
    return Annotation(
        name="clip",
        blinks=[],
        frame_count=frame_count,
        non_frontal_frames=0,
        header={"glasses": "YES" if glasses else "NO"},
    )


class TestCoverageIsARefusalNotAFlag:
    # Roadmap 10.1d. A materially short measurement is compared against a
    # complete annotation, so a >1% coverage gap and a missing
    # frames_measured header refuse the clip rather than footnoting it.
    def test_a_matching_frame_count_passes(self) -> None:
        assert coverage_refusal(1000, 1000) is None

    def test_at_the_one_percent_bar_passes(self) -> None:
        # 1% of 1000 is 10; a gap of exactly 10 is at the bar, not past.
        assert coverage_refusal(1010, 1000) is None
        assert coverage_refusal(990, 1000) is None

    def test_past_the_one_percent_bar_refuses(self) -> None:
        reason = coverage_refusal(1011, 1000)
        assert reason is not None
        assert "coverage gap" in reason
        assert "11" in reason

    def test_the_floor_is_five_frames_on_a_short_clip(self) -> None:
        # max(5, 1%) — on a 100-frame clip 1% is 1, so the 5-frame floor
        # governs: a gap of 5 passes, 6 refuses.
        assert coverage_refusal(105, 100) is None
        assert coverage_refusal(106, 100) is not None

    def test_a_missing_frames_measured_header_refuses(self) -> None:
        reason = coverage_refusal(None, 1000)
        assert reason is not None
        assert "frames_measured" in reason


class TestTheClipRefusalDecision:
    # clip_refusal is the whole per-clip verdict collect() applies.
    def test_a_stepped_clip_within_coverage_is_included(self) -> None:
        assert clip_refusal(_log(), _annotation()) is None

    def test_a_watched_run_is_refused_as_not_every_frame_seen(self) -> None:
        reason = clip_refusal(_log(mode="played"), _annotation())
        assert reason is not None
        assert "played" in reason
        assert "stepped" in reason

    def test_a_stepped_clip_past_coverage_is_refused(self) -> None:
        reason = clip_refusal(_log(frames_measured="2000"), _annotation(1000))
        assert reason is not None
        assert "coverage gap" in reason

    def test_a_missing_frame_count_header_is_refused(self) -> None:
        reason = clip_refusal(_log(frames_measured=None), _annotation())
        assert reason is not None
        assert "frames_measured" in reason


class TestARefusalMakesTheRunPartial:
    # Non-zero exit on a partial corpus: a headline pooled over a subset
    # is not the published headline, so any refusal fails the run even
    # when some clips scored.
    def test_a_clean_full_run_exits_zero(self) -> None:
        assert exit_code([clip("corpus", 341, 67, 65)], []) == 0

    def test_any_refusal_makes_it_non_zero(self) -> None:
        scored = [clip("corpus", 341, 67, 65)]
        assert exit_code(scored, [Refusal("x", "y")]) == 1

    def test_an_empty_run_is_non_zero(self) -> None:
        assert exit_code([], []) == 1


class TestRefusalsAreInTheReportBody:
    # Skips printed into the report body, not stderr: a reader of the
    # printed report must see which clips were left out and why.
    def test_the_report_names_each_refused_clip_and_its_reason(self) -> None:
        text = report(
            [clip("corpus", 341, 67, 65)],
            [Refusal("badclip", "REFUSED, coverage gap of 40 frames")],
        )
        assert "Refused" in text
        assert "badclip" in text
        assert "coverage gap of 40 frames" in text

    def test_a_clean_run_prints_no_refused_section(self) -> None:
        # No refusals, no section — the published report is unchanged.
        assert "Refused" not in report([clip("corpus", 341, 67, 65)])

    def test_empty_with_no_refusals_is_unchanged(self) -> None:
        assert report([]) == "No clips could be evaluated."


class TestTheGlassesSplitSaysNotComputable:
    def test_an_unformable_split_is_named_not_computed_silently(self) -> None:
        # Every clip without glasses: the split cannot be formed, and
        # the report says so rather than omitting the section.
        text = report([clip("a", 30, 5, 2), clip("b", 40, 4, 3)])
        assert "Split by glasses" in text
        assert "not computable" in text

    def test_a_formable_split_is_still_computed(self) -> None:
        a = replace(clip("has", 30, 5, 2), glasses=True)
        b = clip("without", 40, 4, 3)
        text = report([a, b])
        assert "Split by glasses" in text
        assert "not computable" not in text
        assert "with glasses" in text


class TestTheBindingToTheCommittedMissTable:
    # Roadmap 10.1d: the committed miss CSV and the published share are
    # held to each other, so neither can drift alone.
    def test_miss_csv_matches_the_published_share(self) -> None:
        import csv

        misses = (
            REPO_ROOT
            / "docs"
            / "evidence"
            / "2026-08-21-rearm"
            / "eyeblink8_misses.csv"
        )
        text = misses.read_text(encoding="utf-8").splitlines()
        rows = list(csv.DictReader(text))
        total = len(rows)
        closed = sum(1 for r in rows if int(r["fullyClosedFrames"]) > 0)
        assert total == 67
        assert closed == 47
        assert round(closed / total * 100, 1) == 70.1

        result = (REPO_ROOT / "docs" / "eyeblink8-result.txt").read_text(
            encoding="utf-8"
        )
        assert f"{total} misses" in result
        assert str(closed) in result
        assert "70.1%" in result


TAG_HEADER = "#eye-blink annotation file version 1.1\n#glasses: NO\n#start\n"


def _write_tag(
    corpus: Path,
    subject: str,
    name: str,
    blink: tuple[int, int],
    total_frames: int = 1000,
) -> None:
    """One clip's `.tag` in the real nineteen-field shape: one blink,
    frames `blink[0]`..`blink[1]` carrying id 1, every other frame -1."""
    start, end = blink
    rows = [
        ":".join(
            [str(frame), "1" if start <= frame <= end else "-1"]
            + ["X"] * 5
            + ["236", "196", "142", "133", "257", "218"]
            + ["281", "217", "320", "217", "344", "216"]
        )
        for frame in range(total_frames)
    ]
    directory = corpus / subject
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{name}.tag").write_text(
        TAG_HEADER + "\n".join(rows) + "\n", encoding="utf-8"
    )


def _write_blink_log(
    measured: Path,
    name: str,
    detection: tuple[int, int],
    mode: str = "stepped",
    frames_measured: int = 1000,
) -> None:
    """One clip's `<name>.blinks.csv` in the exporter's own shape."""
    start, end = detection
    measured.mkdir(parents=True, exist_ok=True)
    (measured / f"{name}.blinks.csv").write_text(
        "\n".join(
            [
                "# source: file",
                f"# clip: {name}.mp4",
                f"# measurement_mode: {mode}",
                f"# frames_measured: {frames_measured}",
                ",".join(BLINK_COLUMNS),
                f"{start},{end},{start * 33.3},200,3.5,70,50,0.5",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


class TestCollectWalksACorpusOnDisk:
    # Roadmap 10.1d, ladder D1. Every decision collect() applies is
    # pinned one by one above; the walk itself, which pairs each .tag
    # with its blink log by name, loads both and records a refusal for
    # every clip it leaves out, was driven by nothing. These run it over
    # files in the real shapes, so a change to the pairing, the loading
    # or which refusal is recorded goes red here.

    def test_scores_a_measured_clip_and_refuses_an_unmeasured_one(
        self, tmp_path: Path
    ) -> None:
        corpus, measured = tmp_path / "corpus", tmp_path / "measured"
        _write_tag(corpus, "s1", "clipa", (100, 106))
        _write_tag(corpus, "s2", "clipb", (200, 205))
        _write_blink_log(measured, "clipa", (101, 105))
        results, refusals = collect(corpus, measured)
        assert [r.name for r in results] == ["clipa"]
        assert results[0].result.true_positives == 1
        assert results[0].frames_measured == 1000
        assert refusals == [
            Refusal("clipb", "NOT MEASURED, no blink log found")
        ]

    def test_a_watched_log_is_refused_rather_than_scored(
        self, tmp_path: Path
    ) -> None:
        corpus, measured = tmp_path / "corpus", tmp_path / "measured"
        _write_tag(corpus, "s1", "clipa", (100, 106))
        _write_blink_log(measured, "clipa", (101, 105), mode="played")
        results, refusals = collect(corpus, measured)
        assert results == []
        assert [r.name for r in refusals] == ["clipa"]
        assert "played" in refusals[0].reason

    def test_a_short_measurement_is_refused_for_its_coverage(
        self, tmp_path: Path
    ) -> None:
        corpus, measured = tmp_path / "corpus", tmp_path / "measured"
        _write_tag(corpus, "s1", "clipa", (100, 106))
        _write_blink_log(measured, "clipa", (101, 105), frames_measured=900)
        results, refusals = collect(corpus, measured)
        assert results == []
        assert "coverage gap" in refusals[0].reason

    def test_the_walk_feeds_a_partial_report_and_a_failing_exit(
        self, tmp_path: Path
    ) -> None:
        corpus, measured = tmp_path / "corpus", tmp_path / "measured"
        _write_tag(corpus, "s1", "clipa", (100, 106))
        _write_tag(corpus, "s2", "clipb", (200, 205))
        _write_blink_log(measured, "clipa", (101, 105))
        results, refusals = collect(corpus, measured)
        text = report(results, refusals)
        assert "1 clips, 1 annotated blinks, 1 detected" in text
        assert "Refused (1)" in text
        assert "clipb" in text
        assert exit_code(results, refusals) == 1
