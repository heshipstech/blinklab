"""What did the aperture do while a human saw a closure? The autopsy.

The question and its prediction are docs/miss-character.txt, section
"THE AUTOPSY, PREDICTED", committed before this tool existed.
docs/miss-trace.txt named the three stories a per-frame trace can
separate; this tool assigns each missed blink one of four verdicts
from the trace rows inside the annotation's own [startFrame,
endFrame] closed span, and refuses to name a mechanism the trace
cannot show.

The trace is src/core/frameTrace.ts's export, one row per measured
frame of a clip: frameIndex, mediaTimeSeconds, apertureMm,
blinkLineMm. An empty aperture or line cell is null — no trusted
face was measured on that frame. Its data is a corpus run's traces;
until an awake run supplies them (docs/miss-trace.txt records the
first run's traces as quarantined), this tool runs only on the
synthetic traces its tests build.

Usage, from the analysis directory, once trace files exist:

    PYTHONPATH="$PWD" .venv/bin/python tools/miss_autopsy.py \\
        <misses.csv> <trace_dir>

where <trace_dir> holds one trace CSV per clip named <clip>.csv.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

# The four verdicts, defined in docs/miss-character.txt's prediction
# section. Order is the reporting order, not a ranking.
MECHANISMS = (
    "not_measured",
    "no_trusted_face",
    "crossed_line",
    "above_line",
)


@dataclass(frozen=True)
class TraceFrame:
    """One measured frame: its aperture and the line it was compared
    against, each None when no trusted face was measured."""

    aperture_mm: float | None
    blink_line_mm: float | None


# A clip's trace: frameIndex -> the frame the instrument measured.
ClipTrace = dict[int, TraceFrame]


@dataclass(frozen=True)
class MissVerdict:
    clip: str
    blink_id: str
    mechanism: str
    # The smallest apertureMm / blinkLineMm over the closed span,
    # reported ONLY for above_line, where the margin is the whole
    # question. None everywhere else: a ratio over a crossing, a
    # coverage gap or an untrusted span is not a number.
    min_ratio: float | None
    # Frames inside the span that carried a trusted aperture reading.
    measured_frames: int
    fully_closed_frames: int


def clip_trace_from_rows(lines: list[str]) -> ClipTrace:
    """Parse one clip's trace CSV lines into a frameIndex map.

    A duplicated frameIndex refuses: one clip cannot measure the same
    frame twice, so a duplicate means the trace is damaged and
    keeping one silently would hide that.
    """
    trace: ClipTrace = {}
    for row in csv.DictReader(lines):
        frame_index = int(row["frameIndex"])
        if frame_index in trace:
            raise ValueError(
                f"frame {frame_index} appears twice in one clip's "
                f"trace — the trace is damaged"
            )
        trace[frame_index] = TraceFrame(
            aperture_mm=_cell(row.get("apertureMm")),
            blink_line_mm=_cell(row.get("blinkLineMm")),
        )
    return trace


def _cell(value: str | None) -> float | None:
    return None if value is None or value.strip() == "" else float(value)


def classify_miss(miss_row: dict, clip_trace: ClipTrace) -> MissVerdict:
    """Assign one missed blink its mechanism verdict from the trace."""
    start = int(miss_row["startFrame"])
    end = int(miss_row["endFrame"])
    if start > end:
        raise ValueError(
            f"{miss_row['clip']} blink {miss_row['blink_id']}: "
            f"startFrame {start} is after endFrame {end}"
        )
    closed = int(miss_row["fullyClosedFrames"])

    span = [clip_trace[f] for f in range(start, end + 1) if f in clip_trace]
    trusted = [
        f
        for f in span
        if f.aperture_mm is not None and f.blink_line_mm is not None
    ]

    def verdict(mechanism: str, min_ratio: float | None) -> MissVerdict:
        return MissVerdict(
            clip=miss_row["clip"],
            blink_id=miss_row["blink_id"],
            mechanism=mechanism,
            min_ratio=min_ratio,
            measured_frames=len(trusted),
            fully_closed_frames=closed,
        )

    if not span:
        return verdict("not_measured", None)
    if not trusted:
        return verdict("no_trusted_face", None)
    if any(f.aperture_mm < f.blink_line_mm for f in trusted):
        return verdict("crossed_line", None)
    ratios = [f.aperture_mm / f.blink_line_mm for f in trusted]
    return verdict("above_line", min(ratios))


@dataclass(frozen=True)
class AutopsySummary:
    counts: dict[str, int]
    # The fully-closed-frame share of the misses in each mechanism,
    # or None for a mechanism with no misses: a share over nothing is
    # not zero (the miss_overlap.py convention).
    closed_share: dict[str, float | None]


def summarise(verdicts: list[MissVerdict]) -> AutopsySummary:
    counts = dict.fromkeys(MECHANISMS, 0)
    closed: dict[str, list[bool]] = {m: [] for m in MECHANISMS}
    for v in verdicts:
        counts[v.mechanism] += 1
        closed[v.mechanism].append(v.fully_closed_frames > 0)
    share: dict[str, float | None] = {}
    for mechanism, flags in closed.items():
        share[mechanism] = None if not flags else sum(flags) / len(flags)
    return AutopsySummary(counts=counts, closed_share=share)


def _read_misses(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _read_trace(path: Path) -> ClipTrace:
    with path.open(encoding="utf-8", newline="") as handle:
        return clip_trace_from_rows(handle.read().splitlines())


def autopsy(misses_path: Path, trace_dir: Path) -> list[MissVerdict]:
    """Classify every miss whose clip has a trace file in trace_dir.

    A miss whose clip has no <clip>.csv trace is skipped, not guessed:
    the tool reports on the traces it was given.
    """
    traces: dict[str, ClipTrace] = {}
    verdicts: list[MissVerdict] = []
    for miss_row in _read_misses(misses_path):
        clip = miss_row["clip"]
        if clip not in traces:
            trace_path = trace_dir / f"{clip}.csv"
            if not trace_path.exists():
                continue
            traces[clip] = _read_trace(trace_path)
        verdicts.append(classify_miss(miss_row, traces[clip]))
    return verdicts


def _pct(share: float | None) -> str:
    return "-" if share is None else f"{share * 100:.1f}%"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("misses", type=Path)
    parser.add_argument("trace_dir", type=Path)
    arguments = parser.parse_args()
    verdicts = autopsy(arguments.misses, arguments.trace_dir)
    if not verdicts:
        print(
            "no misses classified: no clip in the miss table has a "
            "trace file in the trace directory"
        )
        return 0
    summary = summarise(verdicts)
    print(f"classified {len(verdicts)} misses")
    for mechanism in MECHANISMS:
        print(
            f"  {mechanism:16s} {summary.counts[mechanism]:3d}"
            f"   closed-frame share {_pct(summary.closed_share[mechanism])}"
        )
    above = sorted(
        (v for v in verdicts if v.mechanism == "above_line"),
        key=lambda v: v.min_ratio if v.min_ratio is not None else 0.0,
    )
    if above:
        ratios = [v.min_ratio for v in above if v.min_ratio is not None]
        mid = ratios[len(ratios) // 2]
        print(
            f"above_line min_ratio: closest {above[0].min_ratio:.2f}, "
            f"median {mid:.2f}, farthest {above[-1].min_ratio:.2f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
