"""The iris positive control (docs/iris-occlusion.txt, roadmap 10.5).

The module under test answers one pre-registered question: does the
iris aspect ratio have any dynamic range on the blinks the detector
CAUGHT, or does the model hold its near-circular iris there too? These
tests drive it entirely on synthetic span tables — the real extraction
is produced on the machine that holds the measured folder — and each
refusal has a test that would go green if the refusal were deleted,
which is the mutation discipline the analysis folder runs on.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from blinklab.iris_control import (
    MAX_DROPPED_SHARE,
    MIN_ANALYZABLE_BLINKS,
    MIN_BASELINE_FRAMES,
    RANGE_ABSENT_SHARE,
    RANGE_FLOOR,
    RANGE_PRESENT_SHARE,
    SOFT_FLOOR,
    IrisControlError,
    per_blink_table,
    summarize,
)


def _blink_rows(
    clip: str,
    blink_id: int,
    baseline: list[float],
    span: list[float],
) -> pd.DataFrame:
    """One blink's rows: baseline frames first, then the span frames."""
    span_start = 1000 + blink_id * 100
    rows = []
    for i, ratio in enumerate(baseline):
        rows.append(
            {
                "clip": clip,
                "blink_id": blink_id,
                "spanStart": span_start,
                "spanEnd": span_start + len(span) - 1,
                "frameIndex": span_start - len(baseline) + i,
                "irisAspectRatio": ratio,
                "insideSpan": 0,
            }
        )
    for i, ratio in enumerate(span):
        rows.append(
            {
                "clip": clip,
                "blink_id": blink_id,
                "spanStart": span_start,
                "spanEnd": span_start + len(span) - 1,
                "frameIndex": span_start + i,
                "irisAspectRatio": ratio,
                "insideSpan": 1,
            }
        )
    return pd.DataFrame(rows)


FLAT_BASELINE = [0.9] * MIN_BASELINE_FRAMES


def _corpus(dipping: int, flat: int) -> pd.DataFrame:
    """A corpus of blinks: `dipping` collapse to 0.5, `flat` hold 0.85."""
    frames = []
    blink_id = 0
    for _ in range(dipping):
        span = [0.8, 0.5, 0.8]
        frames.append(_blink_rows("clip-a", blink_id, FLAT_BASELINE, span))
        blink_id += 1
    for _ in range(flat):
        span = [0.86, 0.85, 0.86]
        frames.append(_blink_rows("clip-a", blink_id, FLAT_BASELINE, span))
        blink_id += 1
    return pd.concat(frames, ignore_index=True)


def test_a_collapsing_corpus_reads_range_present() -> None:
    result = summarize(per_blink_table(_corpus(dipping=20, flat=0)))
    assert result.verdict == "range_present"
    assert result.n_blinks == 20
    assert result.blinks_below_floor == 20
    assert result.share_below_floor == 1.0


def test_a_flat_corpus_reads_range_absent() -> None:
    result = summarize(per_blink_table(_corpus(dipping=0, flat=20)))
    assert result.verdict == "range_absent"
    assert result.blinks_below_floor == 0
    assert result.median_in_span_min == pytest.approx(0.85)


def test_a_half_and_half_corpus_reads_partial() -> None:
    result = summarize(per_blink_table(_corpus(dipping=10, flat=10)))
    assert result.verdict == "partial"
    assert result.share_below_floor == pytest.approx(0.5)


def test_the_absent_boundary_is_strict() -> None:
    # Exactly 25% dipped is NOT absent: absent means fewer than the
    # committed share, so the boundary case lands in partial.
    result = summarize(per_blink_table(_corpus(dipping=5, flat=15)))
    assert result.share_below_floor == pytest.approx(RANGE_ABSENT_SHARE)
    assert result.verdict == "partial"


def test_the_present_boundary_is_inclusive() -> None:
    # Exactly 75% dipped IS present, per the committed rule.
    result = summarize(per_blink_table(_corpus(dipping=15, flat=5)))
    assert result.share_below_floor == pytest.approx(RANGE_PRESENT_SHARE)
    assert result.verdict == "range_present"


def test_per_blink_numbers_are_exact_on_a_hand_built_blink() -> None:
    baseline = [0.9, 0.92, 0.88] + FLAT_BASELINE
    table = per_blink_table(
        _blink_rows("clip-b", 7, baseline, [0.84, 0.61, 0.79])
    )
    row = table.iloc[0]
    assert row["clip"] == "clip-b"
    assert row["blink_id"] == 7
    assert row["open_baseline_iris_median"] == pytest.approx(0.9)
    assert row["in_span_iris_median"] == pytest.approx(0.79)
    assert row["in_span_iris_min"] == pytest.approx(0.61)


def test_a_deep_frame_outside_the_span_never_feeds_the_min() -> None:
    # A 0.4 in the BASELINE must not count as the blink dipping: only
    # insideSpan rows answer the closure question.
    frame = _blink_rows("clip-c", 1, [0.4] + FLAT_BASELINE, [0.85, 0.86])
    table = per_blink_table(frame)
    assert table.iloc[0]["in_span_iris_min"] == pytest.approx(0.85)


def test_non_finite_span_ratios_are_ignored_not_counted() -> None:
    frame = _blink_rows("clip-d", 1, FLAT_BASELINE, [0.85, float("nan"), 0.83])
    table = per_blink_table(frame)
    assert table.iloc[0]["in_span_iris_min"] == pytest.approx(0.83)
    assert table.iloc[0]["in_span_frames"] == 2


def test_a_blink_with_only_nan_span_rows_is_dropped_and_counted() -> None:
    good = _corpus(dipping=0, flat=MIN_ANALYZABLE_BLINKS)
    nans = [float("nan"), float("nan")]
    bad = _blink_rows("clip-e", 999, FLAT_BASELINE, nans)
    joined = pd.concat([good, bad], ignore_index=True)
    result = summarize(per_blink_table(joined))
    assert result.n_blinks == MIN_ANALYZABLE_BLINKS
    assert result.n_dropped == 1


def test_a_blink_short_of_baseline_frames_is_dropped_and_counted() -> None:
    good = _corpus(dipping=0, flat=MIN_ANALYZABLE_BLINKS)
    short = [0.9] * (MIN_BASELINE_FRAMES - 1)
    thin = _blink_rows("clip-f", 998, short, [0.5])
    joined = pd.concat([good, thin], ignore_index=True)
    result = summarize(per_blink_table(joined))
    assert result.n_blinks == MIN_ANALYZABLE_BLINKS
    assert result.n_dropped == 1
    # And the dropped dipper must not leak into the verdict counts.
    assert result.blinks_below_floor == 0


def test_soft_floor_blinks_are_counted_separately() -> None:
    frames = pd.concat(
        [
            _corpus(dipping=0, flat=MIN_ANALYZABLE_BLINKS),
            _blink_rows("clip-g", 997, FLAT_BASELINE, [0.75]),
        ],
        ignore_index=True,
    )
    result = summarize(per_blink_table(frames))
    # 0.75 is under the soft floor (0.80) but not under the range floor.
    assert result.blinks_below_soft_floor == 1
    assert result.blinks_below_floor == 0


def test_refuses_a_missing_column() -> None:
    frame = _corpus(dipping=1, flat=0).drop(columns=["irisAspectRatio"])
    with pytest.raises(IrisControlError, match="irisAspectRatio"):
        per_blink_table(frame)


def test_refuses_a_duplicated_frame() -> None:
    frame = _corpus(dipping=1, flat=0)
    with pytest.raises(IrisControlError, match="duplicate"):
        per_blink_table(pd.concat([frame, frame.tail(1)], ignore_index=True))


def test_refuses_a_corpus_below_the_minimum_blink_count() -> None:
    with pytest.raises(IrisControlError, match="20"):
        table = per_blink_table(
            _corpus(dipping=0, flat=MIN_ANALYZABLE_BLINKS - 1)
        )
        summarize(table)


def test_refuses_when_too_many_blinks_were_dropped() -> None:
    good = _corpus(dipping=0, flat=MIN_ANALYZABLE_BLINKS)
    bad = pd.concat(
        [
            _blink_rows("clip-h", 900 + i, FLAT_BASELINE, [float("nan")])
            for i in range(6)  # 6 of 26 dropped is over the 20% ceiling
        ],
        ignore_index=True,
    )
    with pytest.raises(IrisControlError, match="dropped"):
        summarize(per_blink_table(pd.concat([good, bad], ignore_index=True)))


def test_the_committed_decision_rule_matches_the_prediction_document() -> None:
    # The prediction in docs/iris-occlusion.txt fixed the rule before any
    # data: 0.70 floor, under-25% absent, 75%-or-more present, at least
    # 20 blinks, 10 baseline frames, 20% drop ceiling. If a constant
    # here drifts from the committed document, this test names it.
    doc = (
        Path(__file__).resolve().parents[2] / "docs" / "iris-occlusion.txt"
    ).read_text()
    assert "THE POSITIVE CONTROL, PRE-REGISTERED" in doc
    assert RANGE_FLOOR == 0.70 and "below 0.70" in doc
    assert RANGE_ABSENT_SHARE == 0.25 and "fewer than 25%" in doc
    assert RANGE_PRESENT_SHARE == 0.75 and "75% or more" in doc
    assert MIN_ANALYZABLE_BLINKS == 20 and "at least\n20 required" in doc
    assert MIN_BASELINE_FRAMES == 10 and "fewer than 10 finite baseline" in doc
    assert MAX_DROPPED_SHARE == 0.20 and "more than 20% dropped" in doc
    assert SOFT_FLOOR == 0.80


def test_median_statistics_use_finite_values_only() -> None:
    table = per_blink_table(_corpus(dipping=0, flat=MIN_ANALYZABLE_BLINKS))
    result = summarize(table)
    assert np.isfinite(result.median_baseline)
    assert np.isfinite(result.median_in_span_median)
    assert result.median_baseline == pytest.approx(0.9)
    assert result.median_in_span_median == pytest.approx(0.86)
