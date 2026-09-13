"""The false-alarm autopsy, held to the mechanisms it committed.

Roadmap 10.6. docs/false-alarm-character.txt pre-registered four
priority-ordered mechanisms for the 65 Eyeblink8 false alarms, each
read from a fact the false-positive table already carries, with
preparation-sensitivity (before_baseline) named the droppable
sub-question. This tool assigns each row one verdict and reports the
depth of the deep_unannotated residue. It is the precision-side twin of
miss_autopsy.py, and like it runs on tables until the owner's run
supplies the anchor's; these tests build the tables synthetically.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from false_alarm_autopsy import (  # noqa: E402
    MECHANISMS,
    NEAR_ANNOTATION_FRAMES,
    autopsy,
    classify_false_alarm,
    summarise,
    write_verdicts,
)


def _row(**overrides: object) -> dict[str, str]:
    """A false-positive row that is deep_unannotated unless overridden:
    far from any annotation, frontal, after the baseline, deep aperture.
    """
    row = {
        "clip": "clipA",
        "startFrame": "500",
        "endFrame": "502",
        "overlapsNF": "0",
        "beforeBaselineReady": "0",
        "apertureMmAtThatSecond": "2.0",
        "baselineMmAtThatSecond": "9.0",
        "framesToNearestAnnotatedBlink": "200",
    }
    row.update({key: str(value) for key, value in overrides.items()})
    return row


def test_the_four_mechanisms_are_the_committed_ones() -> None:
    assert MECHANISMS == (
        "near_annotation",
        "non_frontal",
        "before_baseline",
        "deep_unannotated",
    )


def test_the_near_window_is_the_refractory_period_in_frames() -> None:
    # 150 ms refractory at 30 fps is 4.5 frames, taken as 5 (the doc's
    # "rounds to 5"): a false alarm within it hugs a real blink.
    assert NEAR_ANNOTATION_FRAMES == 5


def test_a_detection_inside_the_window_is_near_annotation() -> None:
    verdict = classify_false_alarm(_row(framesToNearestAnnotatedBlink=5))
    assert verdict.mechanism == "near_annotation"


def test_a_detection_past_the_window_is_not_near() -> None:
    # Six frames away, and nothing else set: it falls to the residue.
    verdict = classify_false_alarm(_row(framesToNearestAnnotatedBlink=6))
    assert verdict.mechanism == "deep_unannotated"


def test_no_annotation_at_all_is_not_near() -> None:
    # -1 is the "clip annotates no blink" sentinel, not a small distance.
    verdict = classify_false_alarm(_row(framesToNearestAnnotatedBlink=-1))
    assert verdict.mechanism == "deep_unannotated"


def test_a_non_frontal_span_is_non_frontal() -> None:
    verdict = classify_false_alarm(_row(overlapsNF=1))
    assert verdict.mechanism == "non_frontal"


def test_before_the_baseline_is_a_preparation_verdict() -> None:
    verdict = classify_false_alarm(_row(beforeBaselineReady=1))
    assert verdict.mechanism == "before_baseline"


def test_near_annotation_wins_over_non_frontal() -> None:
    # A row that is both near a blink AND non-frontal is named by the
    # first mechanism in priority order.
    verdict = classify_false_alarm(
        _row(framesToNearestAnnotatedBlink=2, overlapsNF=1)
    )
    assert verdict.mechanism == "near_annotation"


def test_non_frontal_wins_over_before_baseline() -> None:
    verdict = classify_false_alarm(_row(overlapsNF=1, beforeBaselineReady=1))
    assert verdict.mechanism == "non_frontal"


def test_deep_unannotated_reports_its_depth_ratio() -> None:
    # aperture 2.0 over baseline 8.0 is a depth ratio of 0.25: a deep
    # plunge the annotation missed.
    verdict = classify_false_alarm(
        _row(apertureMmAtThatSecond=2.0, baselineMmAtThatSecond=8.0)
    )
    assert verdict.mechanism == "deep_unannotated"
    assert verdict.depth_ratio == pytest.approx(0.25)


def test_only_deep_unannotated_carries_a_depth_ratio() -> None:
    # A near/non-frontal/preparation verdict leaves depth None: the
    # depth question is only asked of the residue.
    for row in (
        _row(framesToNearestAnnotatedBlink=1),
        _row(overlapsNF=1),
        _row(beforeBaselineReady=1),
    ):
        assert classify_false_alarm(row).depth_ratio is None


def test_a_deep_row_without_a_baseline_has_no_ratio() -> None:
    # No baseline (or zero) means no ratio, never a zero: a ratio over
    # nothing is not a number (the null-never-zero rule).
    assert (
        classify_false_alarm(_row(baselineMmAtThatSecond="")).depth_ratio
        is None
    )
    assert (
        classify_false_alarm(_row(baselineMmAtThatSecond="0")).depth_ratio
        is None
    )


def test_a_missing_required_column_refuses_by_name() -> None:
    row = _row()
    del row["overlapsNF"]
    with pytest.raises(ValueError, match="overlapsNF"):
        classify_false_alarm(row)


def test_summarise_counts_each_mechanism() -> None:
    verdicts = [
        classify_false_alarm(_row(framesToNearestAnnotatedBlink=1)),
        classify_false_alarm(_row(overlapsNF=1)),
        classify_false_alarm(_row(beforeBaselineReady=1)),
        classify_false_alarm(_row()),
        classify_false_alarm(_row()),
    ]
    summary = summarise(verdicts)
    assert summary.counts == {
        "near_annotation": 1,
        "non_frontal": 1,
        "before_baseline": 1,
        "deep_unannotated": 2,
    }


def test_summarise_reports_deep_depth_spread() -> None:
    # Three deep rows at ratios 0.2, 0.5, 0.8: the summary reports the
    # closest, median and farthest, over the deep group alone.
    verdicts = [
        classify_false_alarm(
            _row(apertureMmAtThatSecond=r, baselineMmAtThatSecond=1.0)
        )
        for r in (0.2, 0.5, 0.8)
    ]
    summary = summarise(verdicts)
    assert summary.deepest_ratio == pytest.approx(0.2)
    assert summary.median_ratio == pytest.approx(0.5)
    assert summary.shallowest_ratio == pytest.approx(0.8)


def test_summarise_has_no_depth_without_a_deep_group() -> None:
    verdicts = [classify_false_alarm(_row(overlapsNF=1))]
    summary = summarise(verdicts)
    assert summary.deepest_ratio is None
    assert summary.median_ratio is None


def test_autopsy_reads_a_table_file(tmp_path: Path) -> None:
    table = tmp_path / "fp.csv"
    with table.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(_row().keys()))
        writer.writeheader()
        writer.writerow(_row(overlapsNF=1))
        writer.writerow(_row())
    verdicts = autopsy(table)
    assert [v.mechanism for v in verdicts] == [
        "non_frontal",
        "deep_unannotated",
    ]


def test_write_verdicts_leaves_depth_blank_off_the_residue(
    tmp_path: Path,
) -> None:
    verdicts = [
        classify_false_alarm(_row(overlapsNF=1)),
        classify_false_alarm(
            _row(apertureMmAtThatSecond=2.0, baselineMmAtThatSecond=8.0)
        ),
    ]
    out = tmp_path / "verdicts.csv"
    write_verdicts(verdicts, out)
    rows = list(csv.DictReader(out.read_text(encoding="utf-8").splitlines()))
    assert rows[0]["mechanism"] == "non_frontal"
    assert rows[0]["depth_ratio"] == ""
    assert rows[1]["mechanism"] == "deep_unannotated"
    assert rows[1]["depth_ratio"] == "0.25"
