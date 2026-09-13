"""The UTA-RLDD per-subject table and the standardised coefficients.

Roadmap 10.10c3. The analysis plan (docs/uta-rldd-plan.md) promised two
things analyse_rldd.py never printed: a table breaking the pooled class
counts down by subject, and the model's standardised coefficients — the
per-feature weights that say which features it leans on, in units made
comparable by z-scoring. This tool prints both.

Like every RLDD tool it reads NUMBERS ONLY: it never sees a frame, and
the feature records it runs on live on the owner's machine, so the real
table is the owner's one-command run. What is provable here, on
synthetic VideoFeatures, is the structure the row's Check pins: the
per-subject rows sum down to the pooled class balance, and the
coefficients are a deterministic function of the records.

    uv run python -m tools.rldd_coefficients <measured-dir>

UTA-RLDD is used under written permission from Professor Vassilis
Athitsos. Cite Ghoddoosian, Galib and Athitsos, CVPR Workshops 2019.
"""

from __future__ import annotations

import argparse
import sys

from blinklab.rldd import (
    LABELS,
    RldError,
    VideoFeatures,
    load_corpus,
    standardized_coefficients,
)


def per_subject_label_counts(
    videos: list[VideoFeatures], labels: tuple[str, ...] = LABELS
) -> dict[str, dict[str, int]]:
    """Per subject, the count of USABLE videos carrying each label.

    Summed down the subjects, each label column recovers the pooled class
    balance analyse_rldd.py already publishes — the invariant the row's
    Check names. Only usable videos are counted, because the excluded
    ones are not in the pooled numbers this must sum to.
    """
    counts: dict[str, dict[str, int]] = {}
    for video in videos:
        if not video.usable or video.label not in labels:
            continue
        row = counts.setdefault(video.subject, dict.fromkeys(labels, 0))
        row[video.label] += 1
    return counts


def format_report(
    videos: list[VideoFeatures], labels: tuple[str, ...] = LABELS
) -> str:
    """The per-subject table and the standardised coefficient table."""
    counts = per_subject_label_counts(videos, labels)
    model = standardized_coefficients(videos, labels)

    lines: list[str] = []
    lines.append("UTA-RLDD per-subject table and standardised coefficients")
    lines.append("Plan fixed in advance: docs/uta-rldd-plan.md")
    lines.append("")

    lines.append("PER-SUBJECT (usable videos by label; columns sum to pooled)")
    header = (
        "  "
        + f"{'subject':<18}"
        + "".join(f"{label[:5]:>7}" for label in labels)
        + f"{'total':>7}"
    )
    lines.append(header)
    totals = dict.fromkeys(labels, 0)
    for subject in sorted(counts):
        row = counts[subject]
        for label in labels:
            totals[label] += row[label]
        cells = "".join(f"{row[label]:>7}" for label in labels)
        lines.append(f"  {subject:<18}{cells}{sum(row.values()):>7}")
    pooled_cells = "".join(f"{totals[label]:>7}" for label in labels)
    lines.append(f"  {'pooled':<18}{pooled_cells}{sum(totals.values()):>7}")
    lines.append("")

    lines.append(
        "STANDARDISED COEFFICIENTS (feature by class; a one-SD change's"
    )
    lines.append(
        "  effect on each class logit — whole-corpus fit, interpretation"
    )
    lines.append("  only, never a held-out claim):")
    coef_header = (
        "  "
        + f"{'feature':<28}"
        + "".join(f"{label[:7]:>9}" for label in model.labels)
    )
    lines.append(coef_header)
    for index, name in enumerate(model.feature_names):
        cells = "".join(
            f"{model.coefficients[index][j]:>9.3f}"
            for j in range(len(model.labels))
        )
        lines.append(f"  {name:<28}{cells}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "measured_dir", help="Folder of <subject>_<label>.seconds.csv files"
    )
    args = parser.parse_args(argv)
    try:
        corpus = load_corpus(args.measured_dir)
        report = format_report(corpus)
    except RldError as error:
        print(f"Cannot build the table: {error}", file=sys.stderr)
        return 1
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
