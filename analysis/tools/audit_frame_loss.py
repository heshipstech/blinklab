"""Count the frames the Eyeblink8 recordings themselves lost.

A published number without its rule is not checkable, and an unchecked
number is how this project once printed "737 lost frames across 3
clips", which no single rule produces. This script exists so the
number and the rule travel together.

THE RULE, stated before any number is read.

Every clip ships a `.txt` file listing the time of each frame the
camera kept, one row per frame. A freeze shows up as a gap. At 30
frames per second one frame lasts 1/30 of a second, so a gap is
rounded to a whole number of frame lengths and everything above the
first one is counted as a lost frame. A gap that rounds to one frame
length is ordinary jitter and counts as nothing.

A long freeze is a gap of half a second or more. That is a second,
separate count, reported separately, because mixing the two is exactly
the mistake this script was written to stop.

A blink is called touched when a gap falls anywhere from one frame
before the blink starts to its last frame. That is the loosest reading
available, chosen deliberately: the figure it feeds is an upper bound
on how much the recordings can excuse, so the loosest reading is the
honest one.

Run it with the corpus root, and optionally a measured directory to
find out how many of the touched blinks the app went on to miss:

    PYTHONPATH="$PWD" .venv/bin/python tools/audit_frame_loss.py \\
        <corpus-root> [<measured-dir>]
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from blinklab.blink_log import load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation

FRAMES_PER_SECOND = 30.0
LONG_FREEZE_SECONDS = 0.5


@dataclass(frozen=True)
class Gap:
    """One break in a clip's timestamps."""

    # Index of the kept frame the gap opens after.
    after_frame: int
    lost_frames: int
    seconds: float

    @property
    def is_long_freeze(self) -> bool:
        return self.seconds >= LONG_FREEZE_SECONDS


@dataclass(frozen=True)
class ClipAudit:
    name: str
    rows: int
    gaps: list[Gap]

    @property
    def lost_frames(self) -> int:
        return sum(gap.lost_frames for gap in self.gaps)

    @property
    def long_freezes(self) -> list[Gap]:
        return [gap for gap in self.gaps if gap.is_long_freeze]


def read_timestamps(path: Path) -> list[float]:
    """Read the second column of a clip's `.txt` timestamp file.

    Refuses a malformed row rather than skipping it. A silently short
    timestamp list would understate the losses, which is the direction
    that flatters the project.
    """
    times: list[float] = []
    for number, line in enumerate(path.read_text().splitlines(), start=1):
        fields = line.split()
        if not fields:
            continue
        if len(fields) != 2:
            raise ValueError(
                f"{path.name} line {number}: expected two fields, "
                f"found {len(fields)}"
            )
        times.append(float(fields[1]))
    if len(times) < 2:
        raise ValueError(f"{path.name}: too few timestamps to audit")
    return times


def find_gaps(times: list[float]) -> list[Gap]:
    """Apply the rule in this file's docstring to one clip."""
    gaps: list[Gap] = []
    for index in range(len(times) - 1):
        seconds = times[index + 1] - times[index]
        lost = round(seconds * FRAMES_PER_SECOND) - 1
        if lost >= 1:
            gaps.append(
                Gap(after_frame=index, lost_frames=lost, seconds=seconds)
            )
    return gaps


def audit_clip(timestamp_path: Path) -> ClipAudit:
    times = read_timestamps(timestamp_path)
    return ClipAudit(
        name=timestamp_path.stem,
        rows=len(times),
        gaps=find_gaps(times),
    )


def touched_blinks(
    corpus_root: Path, measured_dir: Path | None
) -> tuple[int, int, int]:
    """Count annotated blinks a gap falls in, and how many were missed.

    Returns (annotated total, touched, touched and missed). The missed
    count is 0 when no measured directory was given.
    """
    annotated = touched = missed = 0
    for timestamp_path in sorted(corpus_root.glob("*/*.txt")):
        tag_path = timestamp_path.with_suffix(".tag")
        annotation = load_annotation(tag_path)
        gaps = find_gaps(read_timestamps(timestamp_path))
        positions = [gap.after_frame for gap in gaps]

        found: set[int] = set()
        if measured_dir is not None:
            log_path = measured_dir / f"{timestamp_path.stem}.blinks.csv"
            log = load_blink_log(log_path)
            result = match_blinks(
                [blink.interval() for blink in log.blinks],
                [
                    Interval(
                        start_frame=blink.start_frame,
                        end_frame=blink.end_frame,
                    )
                    for blink in annotation.blinks
                ],
            )
            found = {pair[1] for pair in result.pairs}

        annotated += len(annotation.blinks)
        for index, blink in enumerate(annotation.blinks):
            first = blink.start_frame - 1
            if any(first <= where <= blink.end_frame for where in positions):
                touched += 1
                if measured_dir is not None and index not in found:
                    missed += 1
    return annotated, touched, missed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus_root", type=Path)
    parser.add_argument("measured_dir", type=Path, nargs="?", default=None)
    args = parser.parse_args(argv)

    timestamp_paths = sorted(args.corpus_root.glob("*/*.txt"))
    if not timestamp_paths:
        print(f"No timestamp files under {args.corpus_root}", file=sys.stderr)
        return 1

    audits = [audit_clip(path) for path in timestamp_paths]

    print("THE RULE")
    print(f"  One frame lasts 1/{FRAMES_PER_SECOND:.0f} of a second.")
    print("  Round each gap to a whole number of frame lengths.")
    print("  Everything above the first one is a lost frame.")
    print(f"  A long freeze is a gap of {LONG_FREEZE_SECONDS} s or more.")
    print()
    print(
        f"{'clip':24}{'rows':>8}{'gaps':>7}{'lost':>7}"
        f"{'freezes':>9}{'in them':>9}"
    )
    for audit in audits:
        freezes = audit.long_freezes
        print(
            f"{audit.name:24}{audit.rows:>8}{len(audit.gaps):>7}"
            f"{audit.lost_frames:>7}{len(freezes):>9}"
            f"{sum(gap.lost_frames for gap in freezes):>9}"
        )

    lost = sum(audit.lost_frames for audit in audits)
    gaps = sum(len(audit.gaps) for audit in audits)
    clips_hit = sum(1 for audit in audits if audit.gaps)
    freezes = [gap for audit in audits for gap in audit.long_freezes]
    freeze_clips = sum(1 for audit in audits if audit.long_freezes)
    annotated_frames = sum(
        load_annotation(path.with_suffix(".tag")).frame_count
        for path in timestamp_paths
    )

    print()
    print(
        f"{lost} frames lost over {gaps} gaps, in {clips_hit} of "
        f"{len(audits)} clips."
    )
    print(
        f"That is {lost / annotated_frames * 100:.2f}% of the "
        f"{annotated_frames} annotated frames."
    )
    print(
        f"{len(freezes)} long freezes, in {freeze_clips} clips, holding "
        f"{sum(gap.lost_frames for gap in freezes)} of those frames."
    )

    annotated, touched, missed = touched_blinks(
        args.corpus_root, args.measured_dir
    )
    print(f"{touched} of {annotated} annotated blinks are touched by a gap.")
    if args.measured_dir is not None:
        print(
            f"{missed} of those {touched} were missed by the app, so the "
            f"lost frames explain at most {missed} misses."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
