"""The iris positive control (docs/iris-occlusion.txt, roadmap 10.5).

The iris result proved the iris aspect ratio does not FALL on the 49
shallow-aperture misses. That left one honest question open, named in
the result's own caveat: does the ratio fall on ANYTHING — do the
blinks the detector caught pull it down — or does the model hold its
near-circular iris there too, making the signal rangeless in general
at these optics?

This module answers that from a per-frame span extraction (the same
shape as the miss extraction: baseline frames before each caught
blink's span, then the span itself), computing per blink the open
baseline median, the in-span median, and the in-span minimum, and
judging the corpus against the decision rule COMMITTED in
docs/iris-occlusion.txt before any real span was read: range_absent
when fewer than 25% of blinks ever dip below 0.70, range_present at
75% or more, partial between — reported as measured, never rounded to
a sentence.

Nothing here reads a frame or an identity: rows of numbers in, a
table of numbers and a verdict out. The refusals are the contract —
a control that quietly analysed three blinks, or a half-broken
extraction, would look exactly like evidence.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

# The decision rule, fixed in docs/iris-occlusion.txt (the positive
# control's pre-registration) before any caught-blink data was read.
# test_iris_control.py pins these against the committed document, so a
# drifted constant reddens the build instead of silently rescoring the
# prediction.
RANGE_FLOOR = 0.70
SOFT_FLOOR = 0.80
RANGE_ABSENT_SHARE = 0.25
RANGE_PRESENT_SHARE = 0.75
MIN_ANALYZABLE_BLINKS = 20
MIN_BASELINE_FRAMES = 10
MAX_DROPPED_SHARE = 0.20

REQUIRED_COLUMNS = (
    "clip",
    "blink_id",
    "frameIndex",
    "irisAspectRatio",
    "insideSpan",
)


class IrisControlError(ValueError):
    """An extraction the control refuses to score, named."""


@dataclass
class IrisControlSummary:
    """The corpus-level answer, with the counts behind it."""

    n_blinks: int
    n_dropped: int
    median_baseline: float
    median_in_span_median: float
    median_in_span_min: float
    blinks_below_floor: int
    share_below_floor: float
    blinks_below_soft_floor: int
    verdict: str


def per_blink_table(frame: pd.DataFrame) -> pd.DataFrame:
    """One row per caught blink: baseline median, in-span median and min.

    A blink with no finite in-span ratio, or fewer than
    MIN_BASELINE_FRAMES finite baseline ratios, cannot witness its own
    closure and is dropped — recorded in the `analyzable` column so
    summarize() can count the drops rather than lose them.
    """
    missing = [
        column for column in REQUIRED_COLUMNS if column not in frame.columns
    ]
    if missing:
        raise IrisControlError(
            "the extraction is missing required column(s): "
            + ", ".join(missing)
        )
    duplicated = frame.duplicated(subset=["clip", "blink_id", "frameIndex"])
    if bool(duplicated.any()):
        raise IrisControlError(
            "the extraction carries duplicate frames for the same blink; "
            "a doubled row would double-weight its ratio"
        )

    rows = []
    grouped = frame.groupby(["clip", "blink_id"], sort=True)
    for (clip, blink_id), blink in grouped:
        ratio = pd.to_numeric(blink["irisAspectRatio"], errors="coerce")
        finite = np.isfinite(ratio.to_numpy(dtype=float))
        inside = blink["insideSpan"].to_numpy() == 1
        span_ratios = ratio.to_numpy(dtype=float)[finite & inside]
        baseline_ratios = ratio.to_numpy(dtype=float)[finite & ~inside]
        analyzable = (
            span_ratios.size >= 1
            and baseline_ratios.size >= MIN_BASELINE_FRAMES
        )
        rows.append(
            {
                "clip": clip,
                "blink_id": blink_id,
                "open_baseline_iris_median": (
                    float(np.median(baseline_ratios))
                    if analyzable
                    else float("nan")
                ),
                "in_span_iris_median": (
                    float(np.median(span_ratios))
                    if analyzable
                    else float("nan")
                ),
                "in_span_iris_min": (
                    float(np.min(span_ratios)) if analyzable else float("nan")
                ),
                "in_span_frames": int(span_ratios.size),
                "baseline_frames": int(baseline_ratios.size),
                "analyzable": analyzable,
            }
        )
    return pd.DataFrame(rows)


def summarize(per_blink: pd.DataFrame) -> IrisControlSummary:
    """Score the per-blink table against the committed decision rule."""
    analyzable = per_blink[per_blink["analyzable"]]
    n_blinks = int(len(analyzable))
    n_dropped = int(len(per_blink) - n_blinks)

    if len(per_blink) > 0 and n_dropped / len(per_blink) > MAX_DROPPED_SHARE:
        raise IrisControlError(
            f"{n_dropped} of {len(per_blink)} blinks were dropped as "
            "unanalyzable, over the committed 20% ceiling: that is an "
            "extraction defect, not a result"
        )
    if n_blinks < MIN_ANALYZABLE_BLINKS:
        raise IrisControlError(
            f"only {n_blinks} analyzable blinks; the committed rule requires "
            f"at least {MIN_ANALYZABLE_BLINKS} before any verdict"
        )

    mins = analyzable["in_span_iris_min"].to_numpy(dtype=float)
    below_floor = int(np.sum(mins < RANGE_FLOOR))
    share = below_floor / n_blinks
    if share < RANGE_ABSENT_SHARE:
        verdict = "range_absent"
    elif share >= RANGE_PRESENT_SHARE:
        verdict = "range_present"
    else:
        verdict = "partial"

    return IrisControlSummary(
        n_blinks=n_blinks,
        n_dropped=n_dropped,
        median_baseline=float(
            np.median(
                analyzable["open_baseline_iris_median"].to_numpy(dtype=float)
            )
        ),
        median_in_span_median=float(
            np.median(analyzable["in_span_iris_median"].to_numpy(dtype=float))
        ),
        median_in_span_min=float(np.median(mins)),
        blinks_below_floor=below_floor,
        share_below_floor=share,
        blinks_below_soft_floor=int(np.sum(mins < SOFT_FLOOR)),
        verdict=verdict,
    )
