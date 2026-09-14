"""What made the aperture plunge where the ground truth was empty?

Roadmap 10.6. The autopsy's question and its prediction are
docs/false-alarm-character.txt, committed before this tool existed.
Since fix #114 a blink logs only on a DEEP crossing that reopens
briefly, so a false alarm is a genuine deep aperture plunge on a frame
the annotation left empty — not line-riding noise. This tool assigns
each false alarm one of four priority-ordered mechanisms, read from the
facts the false-positive table already carries, and reports the depth
of the residue.

It is the precision-side twin of miss_autopsy.py, and reads only the
false-positive table (analysis/tools/write_false_positive_table.py's
output): the nineteen-column table front-loads the pose, timing,
baseline-readiness and per-second aperture a per-frame trace would
otherwise supply, so no separate trace is needed.

    PYTHONPATH="$PWD" .venv/bin/python tools/false_alarm_autopsy.py \\
        <false_positives.csv> [--out verdicts.csv]
"""

from __future__ import annotations

import argparse
import csv
import math
from dataclasses import dataclass
from pathlib import Path

# The detector's refractory period (src/core/constants.ts,
# BLINK_REFRACTORY_MS at the pre-registration) at the instrument's
# 30 fps clock: 150 ms is 4.5 frames, taken as the whole frame it
# touches — the "rounds to 5" of docs/false-alarm-character.txt. A
# false alarm within this many frames of a real blink hugs that blink.
_BLINK_REFRACTORY_MS = 150
_INSTRUMENT_FPS = 30.0
NEAR_ANNOTATION_FRAMES = math.ceil(
    _BLINK_REFRACTORY_MS * _INSTRUMENT_FPS / 1000
)

# The four verdicts, priority-ordered as docs/false-alarm-character.txt
# committed them: the first that fits names a false alarm that could be
# told more than one story. Not a ranking of severity.
MECHANISMS = (
    "near_annotation",
    "non_frontal",
    "before_baseline",
    "deep_unannotated",
)

# The columns a verdict is read from. A row missing one refuses rather
# than guessing a mechanism the table cannot support.
_REQUIRED_COLUMNS = (
    "framesToNearestAnnotatedBlink",
    "overlapsNF",
    "beforeBaselineReady",
    "apertureMmAtThatSecond",
    "baselineMmAtThatSecond",
)


@dataclass(frozen=True)
class FalseAlarmVerdict:
    clip: str
    start_frame: str
    mechanism: str
    # apertureMm / baselineMm at the second the alarm fired, reported
    # ONLY for deep_unannotated, where the depth is the whole question.
    # None for every other verdict, and None when no baseline was
    # measured: a ratio over nothing is not a number.
    depth_ratio: float | None


def _require(row: dict, key: str) -> str:
    if key not in row:
        raise ValueError(
            f"false-positive row is missing the {key!r} column, which the "
            "autopsy needs to name a mechanism"
        )
    return row[key] or ""


def _number(value: str | None) -> float | None:
    text = (value or "").strip()
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _depth_ratio(row: dict) -> float | None:
    aperture = _number(row.get("apertureMmAtThatSecond"))
    baseline = _number(row.get("baselineMmAtThatSecond"))
    if aperture is None or baseline is None or baseline == 0:
        return None
    return aperture / baseline


def classify_false_alarm(row: dict) -> FalseAlarmVerdict:
    """Assign one false alarm its mechanism, from the table's columns."""
    for key in _REQUIRED_COLUMNS:
        _require(row, key)
    nearest = int(_require(row, "framesToNearestAnnotatedBlink"))
    overlaps_nf = _require(row, "overlapsNF").strip() == "1"
    before_baseline = _require(row, "beforeBaselineReady").strip() == "1"

    def verdict(mechanism: str, depth: float | None) -> FalseAlarmVerdict:
        return FalseAlarmVerdict(
            clip=row.get("clip", ""),
            start_frame=row.get("startFrame", ""),
            mechanism=mechanism,
            depth_ratio=depth,
        )

    # -1 is the "clip annotates no blink" sentinel, not a small
    # distance, so the window is a closed range from zero.
    if 0 <= nearest <= NEAR_ANNOTATION_FRAMES:
        return verdict("near_annotation", None)
    if overlaps_nf:
        return verdict("non_frontal", None)
    if before_baseline:
        return verdict("before_baseline", None)
    return verdict("deep_unannotated", _depth_ratio(row))


@dataclass(frozen=True)
class AutopsySummary:
    counts: dict[str, int]
    # The depth-ratio spread over the deep_unannotated group alone, or
    # None when that group is empty: a spread over nothing is not zero.
    deepest_ratio: float | None
    median_ratio: float | None
    shallowest_ratio: float | None


def summarise(verdicts: list[FalseAlarmVerdict]) -> AutopsySummary:
    counts = dict.fromkeys(MECHANISMS, 0)
    for verdict in verdicts:
        counts[verdict.mechanism] += 1
    ratios = sorted(
        verdict.depth_ratio
        for verdict in verdicts
        if verdict.mechanism == "deep_unannotated"
        and verdict.depth_ratio is not None
    )
    if not ratios:
        return AutopsySummary(counts, None, None, None)
    return AutopsySummary(
        counts=counts,
        # A smaller ratio is a deeper plunge, so the deepest is the min.
        deepest_ratio=ratios[0],
        median_ratio=ratios[len(ratios) // 2],
        shallowest_ratio=ratios[-1],
    )


def autopsy(path: Path) -> list[FalseAlarmVerdict]:
    """Classify every false alarm in a false-positive table."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return [classify_false_alarm(row) for row in rows]


def write_verdicts(verdicts: list[FalseAlarmVerdict], path: Path) -> None:
    """Write one row per verdict as committable evidence.

    depth_ratio is written only for deep_unannotated; every other
    verdict leaves the cell empty, never 0 — the null-never-zero rule.
    """
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["clip", "startFrame", "mechanism", "depth_ratio"])
        for verdict in verdicts:
            writer.writerow(
                [
                    verdict.clip,
                    verdict.start_frame,
                    verdict.mechanism,
                    ""
                    if verdict.depth_ratio is None
                    else f"{verdict.depth_ratio:.6g}",
                ]
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("table", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)

    verdicts = autopsy(args.table)
    if not verdicts:
        print("no false alarms to classify: the table is empty")
        return 0
    if args.out is not None:
        write_verdicts(verdicts, args.out)
        print(f"wrote {len(verdicts)} verdicts to {args.out}")
    summary = summarise(verdicts)
    print(f"classified {len(verdicts)} false alarms")
    for mechanism in MECHANISMS:
        print(f"  {mechanism:16s} {summary.counts[mechanism]:3d}")
    if summary.deepest_ratio is not None:
        print(
            "deep_unannotated depth ratio: "
            f"deepest {summary.deepest_ratio:.2f}, "
            f"median {summary.median_ratio:.2f}, "
            f"shallowest {summary.shallowest_ratio:.2f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
