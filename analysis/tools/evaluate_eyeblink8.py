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
from dataclasses import dataclass
from pathlib import Path

from blinklab.blink_log import BlinkLog, load_blink_log
from blinklab.blink_match import Interval, MatchResult, combine, match_blinks
from blinklab.eyeblink8 import Annotation, load_annotation
from blinklab.stats import wilson_interval


@dataclass(frozen=True)
class ClipResult:
    name: str
    glasses: bool
    annotated: int
    detected: int
    result: MatchResult
    frames_measured: int | None
    frames_annotated: int
    # The delegate the clip's own blink log recorded as requested, or
    # None for a log that predates the key (roadmap 13.5). Defaulted
    # so every older caller keeps meaning what it meant.
    delegate_requested: str | None = None


@dataclass(frozen=True)
class Refusal:
    """A clip left out of the score, with why. Roadmap 10.1d: a clip is
    refused, not footnoted, when including it would make the pooled
    headline about a different recording than the humans annotated."""

    name: str
    reason: str


# Roadmap 10.1d. The instrument may see slightly fewer frames than the
# annotator counted (a dropped tail, a settle), but a materially short
# measurement compared against a complete annotation understates recall
# for a reason unrelated to detection. The bar is one percent, with a
# five-frame floor so a short clip is not refused for rounding.
COVERAGE_GAP_FLOOR = 5
COVERAGE_GAP_FRACTION = 0.01


def coverage_refusal(
    frames_measured: int | None, frames_annotated: int
) -> str | None:
    """Why coverage refuses this clip, or None if it passes.

    A missing frames_measured header is a refusal, not an "unknown": a
    run that cannot say how many frames it saw cannot be shown to have
    covered the annotation, and a coverage report that prints "unknown"
    and scores the clip anyway is the footnote this row replaces."""
    if frames_measured is None:
        return "no frames_measured header, so coverage cannot be checked"
    gap = abs(frames_measured - frames_annotated)
    allowed = max(COVERAGE_GAP_FLOOR, frames_annotated * COVERAGE_GAP_FRACTION)
    if gap > allowed:
        return (
            f"coverage gap of {gap} frames (measured {frames_measured}, "
            f"annotated {frames_annotated}) exceeds the {allowed:.0f}-frame "
            "bar (1%, floor 5)"
        )
    return None


def clip_refusal(log: BlinkLog, annotation: Annotation) -> str | None:
    """The whole per-clip verdict: why this clip is refused from the
    pooled score, or None to include it. A watched (non-stepped) run, a
    missing frame count, and a coverage gap past one percent each
    disqualify a clip, because the published headline is only honest
    over clips measured the way the published one was."""
    if not log.measured_completely:
        return (
            f"SKIPPED, measured in '{log.metadata.get('measurement_mode')}' "
            "mode rather than stepped, so not every frame was seen"
        )
    coverage = coverage_refusal(log.frames_measured, annotation.frame_count)
    if coverage is not None:
        return f"REFUSED, {coverage}"
    return None


def exit_code(results: list[ClipResult], refusals: list[Refusal]) -> int:
    """Non-zero on a partial corpus. A headline pooled over a subset is
    not the published headline, so any refusal fails the run even when
    some clips scored — and a run that scored nothing fails too."""
    return 0 if results and not refusals else 1


def _percent(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def _interval(successes: int, trials: int) -> str:
    """The 95% interval a counted proportion supports, as percentages.

    "n/a" for a denominator of zero, matching `_percent` above: a clip
    with nothing annotated says nothing about whether the instrument
    finds blinks, and an interval of 0 to 100 there would look like a
    measurement of total ignorance rather than the absence of one.
    """
    if trials <= 0:
        return "n/a"
    low, high = wilson_interval(successes, trials)
    return f"{low * 100:.1f} to {high * 100:.1f}"


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
        delegate_requested=log.metadata.get("delegate_requested"),
    )


def delegate_header(requests: list[str | None]) -> str:
    """The run's delegate line: what was REQUESTED, never what ran.

    The vendored API reports no executed delegate (roadmap 13.5), so
    the header carries the request the run's own blink logs recorded.
    A log that predates the delegate_requested key contributes the
    only honest value there is — and a run whose clips disagree is
    reported as mixed rather than averaged into one story.
    """
    if all(request is None for request in requests):
        return "unknown, probe added after this run"
    stated = sorted(
        {"unknown" if request is None else request for request in requests}
    )
    if len(stated) == 1:
        return f"{stated[0]} requested; executed delegate unobservable"
    return f"mixed ({', '.join(stated)}); executed delegate unobservable"


def collect(
    corpus: Path, measured: Path
) -> tuple[list[ClipResult], list[Refusal]]:
    """Score every clip that can be scored, and record why each other
    was left out. The refusals ride back with the results (roadmap
    10.1d) so the report can print them in its body and main can fail a
    partial run, rather than losing them to stderr where the published
    headline reads as complete."""
    results: list[ClipResult] = []
    refusals: list[Refusal] = []
    for tag in sorted(corpus.rglob("*.tag")):
        log_path = measured / f"{tag.stem}.blinks.csv"
        if not log_path.exists():
            refusals.append(
                Refusal(tag.stem, "NOT MEASURED, no blink log found")
            )
            continue
        log = load_blink_log(log_path)
        annotation = load_annotation(tag)
        reason = clip_refusal(log, annotation)
        if reason is not None:
            refusals.append(Refusal(annotation.name, reason))
            continue
        results.append(evaluate_clip(log, annotation))
    return results, refusals


def _refused_section(refusals: list[Refusal] | tuple[()]) -> list[str]:
    """The refused clips, in the report body. Roadmap 10.1d: a reader of
    the printed report must see which clips were left out and why, so
    these are lines in the report rather than notes to stderr."""
    lines = [f"Refused ({len(refusals)})"]
    for refusal in sorted(refusals, key=lambda r: r.name):
        lines.append(f"  {refusal.name[:22]:22} {refusal.reason}")
    return lines


def report(
    results: list[ClipResult], refusals: list[Refusal] | tuple[()] = ()
) -> str:
    if not results and not refusals:
        return "No clips could be evaluated."
    if not results:
        # Every clip was refused: there is no headline, only the reasons.
        lines = ["No clips could be evaluated.", ""]
        lines.extend(_refused_section(refusals))
        return "\n".join(lines)

    lines: list[str] = []
    pooled = combine([r.result for r in results])

    lines.append("BLINK DETECTION vs Eyeblink8 ground truth")
    lines.append("")
    lines.append(
        f"{len(results)} clips, {pooled.annotated} annotated blinks, "
        f"{pooled.detected} detected"
    )
    # Roadmap 13.5. A run's numbers are conditioned on the delegate
    # that produced them, and the header is where a run states its
    # conditions.
    requests = [r.delegate_requested for r in results]
    lines.append(f"  Delegate   {delegate_header(requests)}")
    lines.append("")
    # Roadmap 10.10c1, ladder B8. Recall and precision are counts over
    # counts, and both were published as bare percentages. 83.6% from
    # 408 annotated blinks and 83.6% from 8 read identically, and only
    # one of them is a measurement worth acting on, so each carries the
    # interval its own denominator supports.
    #
    # F1 does not. It is a harmonic mean of two proportions rather than
    # a count over a count, so a Wilson interval there would be
    # arithmetic borrowed from a distribution it does not have. The
    # tempting thing is to put one on every number in the block.
    lines.append(
        f"  Recall     {_percent(pooled.recall)}   "
        f"({pooled.true_positives} of {pooled.annotated} found, "
        f"95% interval {_interval(pooled.true_positives, pooled.annotated)})"
    )
    lines.append(
        f"  Precision  {_percent(pooled.precision)}   "
        f"({pooled.false_positives} invented, "
        f"95% interval {_interval(pooled.true_positives, pooled.detected)})"
    )
    lines.append(f"  F1         {_percent(pooled.f1)}")
    lines.append("")

    # Refused clips, above the per-clip table, so a reader sees the run
    # is partial before reading a headline pooled over a subset.
    if refusals:
        lines.extend(_refused_section(refusals))
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
    lines.append("Split by glasses")
    if with_glasses and without:
        a, b = (
            combine([r.result for r in with_glasses]),
            combine([r.result for r in without]),
        )
        lines.append(
            f"  with glasses    {len(with_glasses)} clip(s), "
            f"recall {_percent(a.recall)}, precision {_percent(a.precision)}"
        )
        lines.append(
            f"  without         {len(without)} clip(s), "
            f"recall {_percent(b.recall)}, precision {_percent(b.precision)}"
        )
    else:
        # Roadmap 10.1d. One side of the split is empty, so the
        # comparison cannot be formed. Said rather than omitted: a
        # silently missing section reads as "not asked", when the truth
        # is "not answerable on this corpus".
        side = "wear glasses" if with_glasses else "are without glasses"
        lines.append(f"  not computable: all {len(results)} clip(s) {side}")
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

    results, refusals = collect(args.corpus, args.measured)
    print(report(results, refusals))
    return exit_code(results, refusals)


if __name__ == "__main__":
    raise SystemExit(main())
