"""Can blinklab's features classify UTA-RLDD's drowsiness states?

This runs the analysis written down in docs/uta-rldd-plan.md, which was
committed BEFORE any classifier was fit. Nothing here chooses what to test:
the features, the model, the leave-one-subject-out scheme, the majority
floor, the label-shuffle control and the decision rule were all fixed in
advance, and this script executes that plan rather than exploring it.

If you find yourself editing this file to try a different window, a
different model, or a different cut of the subjects, stop and read the plan
first. That is the exact move it exists to prevent.

Usage, from the analysis directory, once the owner's feature CSVs exist:

    uv run python -m tools.analyse_rldd <measured-dir>

<measured-dir> holds the `<subject>_<label>.seconds.csv` files the corpus
runner produced. This reads NUMBERS ONLY; it never sees a frame.

`--shuffles` and `--seed` default to the plan's pair. The published
result's robustness reseeds are the same command with `--shuffles 250
--seed 42` and `--shuffles 250 --seed 2024`, and the report of such a run
names its pair as NOT the pre-registered one.

UTA-RLDD is used under written permission from Professor Vassilis Athitsos.
Cite Ghoddoosian, Galib and Athitsos, CVPR Workshops 2019, wherever these
results appear in any form.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

from blinklab.drozy import MIN_USABLE_FPS
from blinklab.loader import cohort_commit_line
from blinklab.rldd import (
    BINARY_LABELS,
    LABELS,
    SEED,
    SHUFFLES,
    LosoResult,
    RldError,
    ShuffleControl,
    VideoFeatures,
    leave_one_subject_out,
    load_corpus,
    shuffle_control,
)


def exclusion_reason(video: VideoFeatures) -> str | None:
    """Why a video is set aside, or None if it is analysed. Both reasons
    are properties fixed before any label is read (docs/uta-rldd-plan.md):
    the frame-rate floor and a recording that covers the five-minute
    window."""
    if video.measured_fps < MIN_USABLE_FPS:
        # Two decimals, not one: a video at 24.98 fps is genuinely below
        # the floor, and rounding it to "25.0" in the reason reads like a
        # contradiction in the published result.
        return (
            f"below {MIN_USABLE_FPS} fps (measured {video.measured_fps:.2f})"
        )
    if not video.reached_window_end:
        return "under five measured minutes after the settle"
    return None


@dataclass(frozen=True)
class AnalysisResult:
    """Everything the report needs, computed once from a corpus."""

    total: int
    usable: list[VideoFeatures]
    excluded: list[tuple[VideoFeatures, str]]
    # The distinct builds that recorded the corpus, unstamped files
    # left out (roadmap 11.8a). The report STATES this set rather than
    # refusing a mix: the published corpus predates the build stamp,
    # and a refusal here would break re-derivation of that result.
    commits: list[str]
    three_class: LosoResult
    three_control: ShuffleControl
    binary: LosoResult
    binary_control: ShuffleControl
    # The pair both label-shuffle controls were drawn from (remediation
    # B8). A permutation p reproduces only from the count and seed that
    # drew it, so the report states them rather than leaving them to the
    # source.
    shuffles: int
    seed: int


def shuffle_line(shuffles: int, seed: int) -> str:
    """The report line naming the shuffle count and seed, and whether they
    are the plan's.

    Remediation B8. The published result records two robustness reseeds
    (250 shuffles each, seeds 42 and 2024) that no command could
    reproduce. With the pair now settable, a reseeded report must not
    read as the pre-registered one, so any other pair is named beside
    the plan's rather than printed as if it were the analysis."""
    if shuffles == SHUFFLES and seed == SEED:
        return (
            f"label shuffles    {shuffles} from seed {seed}, as pre-registered"
        )
    return (
        f"label shuffles    {shuffles} from seed {seed}, NOT the "
        f"pre-registered {SHUFFLES} from seed {SEED}"
    )


def run_analysis(
    corpus: list[VideoFeatures],
    *,
    shuffles: int = SHUFFLES,
    seed: int = SEED,
) -> AnalysisResult:
    """The whole pre-registered evaluation over one corpus: the three-class
    leave-one-subject-out and its shuffle control, then the alert-vs-drowsy
    secondary and its own. Raises RldError if nothing survives the gates."""
    usable = [v for v in corpus if v.usable]
    excluded = [
        (v, reason)
        for v in corpus
        if (reason := exclusion_reason(v)) is not None
    ]
    if not usable:
        raise RldError("no usable videos after the fps and window gates")
    three_class = leave_one_subject_out(usable, LABELS)
    three_control = shuffle_control(
        usable, LABELS, shuffles=shuffles, seed=seed
    )
    binary_usable = [v for v in usable if v.label in BINARY_LABELS]
    binary = leave_one_subject_out(binary_usable, BINARY_LABELS)
    binary_control = shuffle_control(
        binary_usable, BINARY_LABELS, shuffles=shuffles, seed=seed
    )
    return AnalysisResult(
        total=len(corpus),
        usable=usable,
        excluded=excluded,
        commits=sorted(
            {v.app_commit for v in corpus if v.app_commit is not None}
        ),
        three_class=three_class,
        three_control=three_control,
        binary=binary,
        binary_control=binary_control,
        shuffles=shuffles,
        seed=seed,
    )


def _class_counts(videos: list[VideoFeatures], labels: tuple[str, ...]) -> str:
    counts = dict.fromkeys(labels, 0)
    for video in videos:
        if video.label in counts:
            counts[video.label] += 1
    return ", ".join(f"{label} {counts[label]}" for label in labels)


def _confusion_block(result: LosoResult) -> list[str]:
    header = "      " + "".join(f"{label[:5]:>7}" for label in result.labels)
    lines = ["  confusion (rows true, columns predicted):", header]
    for i, label in enumerate(result.labels):
        row = "".join(f"{count:>7}" for count in result.confusion[i])
        lines.append(f"  {label[:5]:>5}{row}")
    return lines


def _control_block(control: ShuffleControl, title: str) -> list[str]:
    return [
        f"  {title}",
        f"    observed balanced accuracy   {control.observed:.3f}",
        f"    null 97.5th percentile       {control.null_percentile_975:.3f}"
        f"   (mean {control.null.mean():.3f})",
        f"    permutation p                {control.p_value:.4f}",
    ]


def _verdict_narrative(control: ShuffleControl) -> str:
    """The closing paragraph for each of the plan's three outcomes. It must
    branch on all three: a bare `detected`/else split would print the
    collapse-to-the-null narrative for a SUGGESTIVE result, which did not
    collapse to the null, contradicting the verdict line printed above it."""
    if control.detected:
        return (
            "  A held-out accuracy above chance that SURVIVED the label "
            "shuffle.\n  Per the plan this is the surprising, genuine "
            "finding, reported as such."
        )
    if control.suggestive:
        return (
            "  One of the plan's two bars cleared and the other did not, "
            "so per\n  the plan this is SUGGESTIVE AND UNCONFIRMED, in "
            "those words: not\n  a finding, and not a clean null, and NOT "
            "detecting drowsiness."
        )
    return (
        "  Per the plan, this is the result, published as readily as a "
        "positive\n  one would have been. An accuracy that collapses to its "
        "shuffled null\n  was reading the subject, not drowsiness."
    )


def format_report(result: AnalysisResult) -> str:
    """The plan's report as text: what was excluded and why, the class
    balance, the three-class leave-one-subject-out with its confusion
    matrix and per-subject scores, the shuffle control, the alert-vs-drowsy
    secondary, and the verdict by the rule fixed before the data."""
    lines: list[str] = []
    lines.append(
        "UTA-RLDD: can the features classify self-reported drowsiness "
        "across strangers?"
    )
    lines.append("Plan fixed in advance: docs/uta-rldd-plan.md")
    lines.append("")
    lines.append(f"  videos measured   {result.total}")
    lines.append(f"  excluded          {len(result.excluded)}")
    for video, reason in result.excluded:
        lines.append(f"    {video.subject}_{video.label}: {reason}")
    subjects = sorted({v.subject for v in result.usable})
    lines.append(f"  analysed          {len(result.usable)}")
    lines.append(f"  subjects          {len(subjects)}")
    lines.append(f"  class balance     {_class_counts(result.usable, LABELS)}")
    lines.append(f"  {cohort_commit_line(result.commits)}")
    lines.append(f"  {shuffle_line(result.shuffles, result.seed)}")
    lines.append("")

    floor = 1.0 / len(LABELS)
    lines.append("PRIMARY, three-class leave-one-subject-out")
    lines.append(
        f"  balanced accuracy   {result.three_class.balanced_accuracy:.3f}"
        f"   majority floor 1/3 = {floor:.3f}"
    )
    if result.three_class.imputed_cells:
        lines.append(
            f"  imputed cells       {result.three_class.imputed_cells}"
            f"   (in-fold median, a rare unmeasured feature)"
        )
    lines.extend(_confusion_block(result.three_class))
    lines.append("  per-subject balanced accuracy:")
    for subject, accuracy in result.three_class.per_subject_accuracy().items():
        lines.append(f"    {subject:<18}{accuracy:.3f}")
    lines.append("")
    lines.append("NEGATIVE CONTROL, labels shuffled, three-class")
    lines.extend(_control_block(result.three_control, "label shuffle"))
    lines.append("")

    binary_floor = 1.0 / len(BINARY_LABELS)
    lines.append(
        "SECONDARY, alert versus drowsy (the low-vigilant middle dropped)"
    )
    lines.append(
        f"  balanced accuracy   {result.binary.balanced_accuracy:.3f}"
        f"   majority floor 1/2 = {binary_floor:.3f}"
    )
    lines.extend(_confusion_block(result.binary))
    lines.extend(_control_block(result.binary_control, "label shuffle"))
    lines.append("")

    lines.append("VERDICT, by the rule fixed before the data was seen")
    lines.append(
        "  a result DETECTS drowsiness only if its accuracy is above the "
        "97.5th"
    )
    lines.append(
        "  percentile of the shuffled null AND clears the floor by a margin "
        "the"
    )
    lines.append("  null's own spread shows is not chance:")
    lines.append(f"    three-class         {result.three_control.verdict}")
    lines.append(f"    alert vs drowsy     {result.binary_control.verdict}")
    lines.append("")
    lines.append(_verdict_narrative(result.three_control))
    lines.append("")
    lines.append(
        "Cite: Ghoddoosian, Galib and Athitsos, "
        '"A Realistic Dataset and Baseline Temporal Model for Early '
        'Drowsiness Detection," CVPR Workshops 2019.'
    )
    return "\n".join(lines)


def _shuffle_count(text: str) -> int:
    """A shuffle count from the command line: a whole number, at least one.
    Zero would leave the null empty and fail inside numpy's percentile,
    far from the flag that caused it."""
    try:
        count = int(text)
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"{text!r} is not a whole number"
        ) from None
    if count < 1:
        raise argparse.ArgumentTypeError(f"must be at least 1, not {count}")
    return count


def build_parser() -> argparse.ArgumentParser:
    """The command line. The shuffle flags default to the plan's pair, so
    the bare command is the pre-registered analysis; any other pair is a
    robustness reseed, and the report says so (`shuffle_line`)."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "measured_dir", help="Folder of <subject>_<label>.seconds.csv files"
    )
    parser.add_argument(
        "--shuffles",
        type=_shuffle_count,
        default=SHUFFLES,
        help=f"label shuffles per control (default {SHUFFLES}, the plan's)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=SEED,
        help=f"seed the shuffles are drawn from (default {SEED}, the plan's)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        corpus = load_corpus(args.measured_dir)
        result = run_analysis(corpus, shuffles=args.shuffles, seed=args.seed)
    except RldError as error:
        print(f"Cannot run the analysis: {error}", file=sys.stderr)
        return 1
    print(format_report(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
