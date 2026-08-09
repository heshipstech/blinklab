"""How many false alarms sit on top of a real blink, under two rules.

A false alarm here is a detection the evaluator could not pair with an
annotated blink. The README wants to say that most of them are not
imagined from nothing: they land on a blink that another detection had
already claimed. That is one blink counted twice.

"Lands on a real blink" needs a rule, and there are two honest ones.

RULE ONE, the tolerance rule. Widen the detection by four frames at each
end. If the widened detection shares at least one frame with a blink the
human marked, it lands on a real blink. Four frames is the same slack the
evaluator already allows when it decides which detections are correct. It
is in blinklab/blink_match.py as DEFAULT_TOLERANCE_FRAMES, and at 30
frames per second it is about 130 milliseconds.

RULE TWO, the strict rule. Do not widen anything. If the detection itself
shares at least one frame with a blink the human marked, it lands on a
real blink.

Both counts are printed, so a reader can check either. Neither count
changes recall, precision or F1. Those come from the pairing, which this
script does not touch.

Run it like this, from the analysis directory, with your own paths:

    PYTHONPATH="$PWD" .venv/bin/python \\
        ../docs/evidence/2026-08-09/scripts/checks/false_positive_overlap.py \\
        <corpus-root> <measured-dir>

The corpus root is the folder holding the Eyeblink8 .tag files. The
measured directory is the folder of .blinks.csv files from the run.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from blinklab.blink_log import load_blink_log
from blinklab.blink_match import (
    DEFAULT_TOLERANCE_FRAMES,
    Interval,
    match_blinks,
)
from blinklab.eyeblink8 import load_annotation

# A detection three frames long or shorter is the short double fire the
# README describes. Reported here so that claim is checkable too.
SHORT_DETECTION_FRAMES = 3


@dataclass(frozen=True)
class FalseAlarm:
    """One detection that no annotated blink was paired with."""

    clip: str
    start_frame: int
    end_frame: int
    touches_with_tolerance: bool
    touches_strictly: bool

    @property
    def frame_count(self) -> int:
        # Closed interval: frames 10 to 12 is three frames, not two.
        return self.end_frame - self.start_frame + 1


def touches_any(
    detection: Interval, annotated: list[Interval], tolerance: int
) -> bool:
    """True when the detection shares a frame with any annotated blink.

    The detection is widened by `tolerance` frames at each end first.
    A tolerance of 0 is the strict rule.
    """
    return any(
        detection.overlap(blink, tolerance) > 0 for blink in annotated
    )


def collect(corpus: Path, measured: Path) -> list[FalseAlarm]:
    """Find every false alarm in the run, and test both rules on it."""
    alarms: list[FalseAlarm] = []
    for tag in sorted(corpus.rglob("*.tag")):
        log_path = measured / f"{tag.stem}.blinks.csv"
        if not log_path.exists():
            raise SystemExit(
                f"No blink log for {tag.stem} in {measured}. Every clip "
                "must be measured, or the counts below are about a "
                "different corpus than the one the README describes."
            )
        log = load_blink_log(log_path)
        if not log.measured_completely:
            # Same refusal the evaluator makes. A partial measurement
            # compared against a complete annotation is a number about
            # frames the instrument never saw.
            raise SystemExit(
                f"{tag.stem} was measured in "
                f"'{log.metadata.get('measurement_mode')}' mode rather "
                "than stepped, so not every frame was seen."
            )

        annotation = load_annotation(tag)
        detected = [blink.interval() for blink in log.blinks]
        annotated = [
            Interval(start_frame=b.start_frame, end_frame=b.end_frame)
            for b in annotation.blinks
        ]

        result = match_blinks(detected, annotated)
        paired = {d_index for d_index, _a_index in result.pairs}
        for index, detection in enumerate(detected):
            if index in paired:
                continue
            alarms.append(
                FalseAlarm(
                    clip=annotation.name,
                    start_frame=detection.start_frame,
                    end_frame=detection.end_frame,
                    touches_with_tolerance=touches_any(
                        detection, annotated, DEFAULT_TOLERANCE_FRAMES
                    ),
                    touches_strictly=touches_any(detection, annotated, 0),
                )
            )
    return alarms


def report(alarms: list[FalseAlarm]) -> str:
    total = len(alarms)
    if total == 0:
        return "No false alarms in this run."

    with_tolerance = sum(1 for a in alarms if a.touches_with_tolerance)
    strict = sum(1 for a in alarms if a.touches_strictly)
    short = sum(1 for a in alarms if a.frame_count <= SHORT_DETECTION_FRAMES)

    lines: list[str] = []
    lines.append("FALSE ALARMS THAT LAND ON A REAL BLINK")
    lines.append("")
    lines.append(f"{total} false alarms in this run.")
    lines.append("")
    lines.append(
        f"  tolerance rule  {with_tolerance} of {total}   "
        f"({with_tolerance / total * 100:.1f}%)   "
        f"detection widened by {DEFAULT_TOLERANCE_FRAMES} frames each end"
    )
    lines.append(
        f"  strict rule     {strict} of {total}   "
        f"({strict / total * 100:.1f}%)   detection not widened"
    )
    lines.append("")
    lines.append(
        f"  {short} of {total} are {SHORT_DETECTION_FRAMES} frames long "
        "or shorter."
    )
    lines.append("")

    lines.append("Per clip")
    lines.append(
        f"  {'clip':22} {'false':>6} {'tolerance':>10} {'strict':>7}"
    )
    for name in sorted({a.clip for a in alarms}):
        rows = [a for a in alarms if a.clip == name]
        lines.append(
            f"  {name[:22]:22} {len(rows):6} "
            f"{sum(1 for a in rows if a.touches_with_tolerance):10} "
            f"{sum(1 for a in rows if a.touches_strictly):7}"
        )
    lines.append("")

    lines.append(
        "Only the tolerance rule counts these, listed so the difference "
        "between the two rules is readable"
    )
    near_misses = [
        a
        for a in alarms
        if a.touches_with_tolerance and not a.touches_strictly
    ]
    if not near_misses:
        lines.append("  none")
    for alarm in near_misses:
        lines.append(
            f"  {alarm.clip[:22]:22} frames {alarm.start_frame} to "
            f"{alarm.end_frame}"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", type=Path, help="Extracted Eyeblink8 root")
    parser.add_argument("measured", type=Path, help="Blink logs from the run")
    args = parser.parse_args(argv)

    print(report(collect(args.corpus, args.measured)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
