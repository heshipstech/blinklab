"""Compare this project's blink detection against Eyeblink8's ground truth.

The first time anything here is measured against somebody else's work.

Run it after tools/measure_corpus.mjs has produced the blink logs:

    uv run python tools/evaluate_eyeblink8.py \\
        <corpus-root> <measured-dir>

The rules it applies were fixed in blinklab/blink_match.py BEFORE any
result was seen, which is the only way a rule can be honest: a matching
criterion chosen after looking at the score is an advertisement.

Three properties this deliberately has.

It refuses a clip whose measurement was not complete. A watched run is
capped by how fast the model happened to run on that machine, and
blaming the detector for frames it never saw would understate the
recall for a reason that has nothing to do with detection.

It pools counts across clips rather than averaging their rates, so a
clip with 30 blinks does not carry the same weight as one with 88.

It reports the glasses clip separately. Strong prescription lenses are
this project's documented weak spot, and a corpus average would hide
whether that weakness is real.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from blinklab.blink_log import BlinkLog, load_blink_log
from blinklab.blink_match import Interval, MatchResult, combine, match_blinks
from blinklab.eyeblink8 import Annotation, load_annotation


@dataclass(frozen=True)
class ClipResult:
    name: str
    glasses: bool
    annotated: int
    detected: int
    result: MatchResult
    frames_measured: int | None
    frames_annotated: int


def _percent(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def evaluate_clip(log: BlinkLog, annotation: Annotation) -> ClipResult:
    detected = [blink.interval() for blink in log.blinks]
    annotated = [
        Interval(start_frame=b.start_frame, end_frame=b.end_frame)
        for b in annotation.blinks
    ]
    return ClipResult(
        name=annotation.name,
        glasses=annotation.wears_glasses,
        annotated=len(annotated),
        detected=len(detected),
        result=match_blinks(detected, annotated),
        frames_measured=log.frames_measured,
        frames_annotated=annotation.frame_count,
    )


def collect(corpus: Path, measured: Path) -> list[ClipResult]:
    results: list[ClipResult] = []
    for tag in sorted(corpus.rglob("*.tag")):
        log_path = measured / f"{tag.stem}.blinks.csv"
        if not log_path.exists():
            print(
                f"  {tag.stem}: NOT MEASURED, no blink log found",
                file=sys.stderr,
            )
            continue
        log = load_blink_log(log_path)
        if not log.measured_completely:
            # Refused rather than included with a caveat. A partial
            # measurement compared against a complete annotation
            # produces a recall figure that is wrong for a reason
            # unrelated to detection, and a caveat in a footnote does
            # not stop that number being quoted.
            print(
                f"  {tag.stem}: SKIPPED, measured in "
                f"'{log.metadata.get('measurement_mode')}' mode rather than "
                "stepped, so not every frame was seen",
                file=sys.stderr,
            )
            continue
        results.append(evaluate_clip(log, load_annotation(tag)))
    return results


def report(results: list[ClipResult]) -> str:
    if not results:
        return "No clips could be evaluated."

    lines: list[str] = []
    pooled = combine([r.result for r in results])

    lines.append("BLINK DETECTION vs Eyeblink8 ground truth")
    lines.append("")
    lines.append(
        f"{len(results)} clips, {pooled.annotated} annotated blinks, "
        f"{pooled.detected} detected"
    )
    lines.append("")
    lines.append(
        f"  Recall     {_percent(pooled.recall)}   "
        f"({pooled.true_positives} of {pooled.annotated} found)"
    )
    lines.append(
        f"  Precision  {_percent(pooled.precision)}   "
        f"({pooled.false_positives} invented)"
    )
    lines.append(f"  F1         {_percent(pooled.f1)}")
    lines.append("")

    lines.append("Per clip")
    lines.append(
        f"  {'clip':22} {'gl':3} {'true':>5} {'found':>6} {'miss':>5} "
        f"{'false':>6} {'recall':>8} {'prec':>8}"
    )
    for r in sorted(results, key=lambda r: r.name):
        lines.append(
            f"  {r.name[:22]:22} {'yes' if r.glasses else '  -':3} "
            f"{r.annotated:5} {r.result.true_positives:6} "
            f"{r.result.false_negatives:5} {r.result.false_positives:6} "
            f"{_percent(r.result.recall):>8} "
            f"{_percent(r.result.precision):>8}"
        )
    lines.append("")

    # The glasses split. This project's README already states that
    # strong prescription lenses degrade the gaze signal; whether they
    # degrade BLINK detection is a separate question nobody has asked
    # it before, and a corpus average would bury the answer.
    with_glasses = [r for r in results if r.glasses]
    without = [r for r in results if not r.glasses]
    if with_glasses and without:
        a, b = (
            combine([r.result for r in with_glasses]),
            combine([r.result for r in without]),
        )
        lines.append("Split by glasses")
        lines.append(
            f"  with glasses    {len(with_glasses)} clip(s), "
            f"recall {_percent(a.recall)}, precision {_percent(a.precision)}"
        )
        lines.append(
            f"  without         {len(without)} clip(s), "
            f"recall {_percent(b.recall)}, precision {_percent(b.precision)}"
        )
        lines.append("")

    # Coverage. If the instrument saw materially fewer frames than the
    # annotator did, every number above is about a different recording
    # than the one the humans watched.
    lines.append("Coverage")
    for r in sorted(results, key=lambda r: r.name):
        measured = (
            "unknown" if r.frames_measured is None else str(r.frames_measured)
        )
        flag = ""
        if r.frames_measured is not None:
            gap = abs(r.frames_measured - r.frames_annotated)
            if gap > max(5, r.frames_annotated * 0.01):
                flag = "  <-- MISMATCH"
        lines.append(
            f"  {r.name[:22]:22} measured {measured:>7}, "
            f"annotated {r.frames_annotated:>7}{flag}"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", type=Path, help="Extracted Eyeblink8 root")
    parser.add_argument("measured", type=Path, help="Blink logs from the run")
    args = parser.parse_args(argv)

    results = collect(args.corpus, args.measured)
    print(report(results))
    return 0 if results else 1


if __name__ == "__main__":
    raise SystemExit(main())
