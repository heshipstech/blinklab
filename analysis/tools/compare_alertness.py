"""Does a learned weighting beat the demo alertness heuristic?

This runs the comparison written down in docs/alertness-score-plan.md, which
was committed BEFORE this code existed and BEFORE it was run. Nothing here
chooses what to test: the baseline (the demo heuristic, ported from
src/core/score.ts), the contender (the leave-one-subject-out model from
blinklab.rldd), the metric (threshold-free alert-vs-drowsy AUC), the two
shuffle controls and the two-bar decision rule were all fixed in advance.

If you find yourself editing this file to try a different metric, a different
cut of the videos, or a different reduction, stop and read the plan first.

Usage, from the analysis directory:

    uv run python -m tools.compare_alertness <measured-dir>

<measured-dir> holds the `<subject>_<label>.seconds.csv` files. This reads
NUMBERS ONLY; it never sees a frame.

UTA-RLDD is used under written permission from Professor Vassilis Athitsos.
Cite Ghoddoosian, Galib and Athitsos, CVPR Workshops 2019, wherever these
results appear in any form.
"""

from __future__ import annotations

import argparse
import sys

from blinklab.alertness import (
    AlertnessComparison,
    AlertnessError,
    compare,
    load_scored_corpus,
)


def format_report(result: AlertnessComparison) -> str:
    """The plan's report as text: the usable set, the two AUCs against their
    shuffle nulls, the two-bar verdict, and the ordinal secondary."""
    lines: list[str] = []
    above = "YES" if result.heuristic_above_chance else "NO"
    beats = "YES" if result.model_beats_heuristic else "NO"
    lines.append(
        "Alertness score: does a learned weighting beat the demo heuristic?"
    )
    lines.append("Plan fixed in advance: docs/alertness-score-plan.md")
    lines.append("")
    lines.append(
        f"  videos compared   {result.n_videos}   (alert/drowsy only)"
    )
    lines.append(f"  subjects          {result.n_subjects}")
    lines.append(
        f"  class balance     alert {result.n_alert}, drowsy {result.n_drowsy}"
    )
    lines.append("")

    lines.append("PRIMARY, alert-vs-drowsy AUC (1.0 perfect, 0.5 chance)")
    lines.append(f"  demo heuristic AUC    {result.heuristic_auc:.3f}")
    lines.append(f"  learned model AUC     {result.model_auc:.3f}")
    lines.append(f"  model - heuristic     {result.diff:+.3f}")
    lines.append("")

    lines.append("BAR 1, is the heuristic above chance?")
    lines.append(
        f"  observed AUC          {result.heuristic_auc:.3f}"
        f"   null 97.5th {result.heuristic_null_975:.3f}"
        f"   (mean {result.null_heuristic.mean():.3f})"
    )
    lines.append(f"  permutation p         {result.heuristic_p:.4f}")
    lines.append(f"  above chance          {above}")
    lines.append("")

    lines.append("BAR 2, does the learned model beat the heuristic?")
    lines.append(
        f"  observed difference   {result.diff:+.3f}"
        f"   null 97.5th {result.diff_null_975:+.3f}"
        f"   (mean {result.null_diff.mean():+.3f})"
    )
    lines.append(f"  permutation p         {result.diff_p:.4f}")
    lines.append(f"  beats heuristic       {beats}")
    lines.append("")

    lines.append("SECONDARY, ordinal Spearman (alert < low-vigilant < drowsy)")
    lines.append(f"  demo heuristic        {result.heuristic_spearman:+.3f}")
    lines.append(f"  learned model         {result.model_spearman:+.3f}")
    lines.append("")

    lines.append("VERDICT, by the rule fixed before the data was seen")
    lines.append(f"  {result.verdict}")
    lines.append("")
    lines.append(
        "Cross-subject classification is NOT a live per-person meter."
    )
    lines.append(
        "This compares which fixed weighting better separates a coarse"
    )
    lines.append(
        "self-reported label across strangers, not which is the better"
    )
    lines.append("live dial for one person over time.")
    lines.append("")
    lines.append(
        "Cite: Ghoddoosian, Galib and Athitsos, "
        '"A Realistic Dataset and Baseline Temporal Model for Early '
        'Drowsiness Detection," CVPR Workshops 2019.'
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "measured_dir", help="Folder of <subject>_<label>.seconds.csv files"
    )
    args = parser.parse_args(argv)
    try:
        corpus = load_scored_corpus(args.measured_dir)
        result = compare(corpus)
    except AlertnessError as error:
        print(f"Cannot run the comparison: {error}", file=sys.stderr)
        return 1
    print(format_report(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
