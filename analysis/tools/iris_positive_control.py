"""Run the iris positive control on a caught-blink span extraction.

The prediction and the decision rule, fixed before any caught-blink
data was read, are in docs/iris-occlusion.txt ("THE POSITIVE CONTROL,
PRE-REGISTERED", roadmap 10.5). This tool reads a per-frame span
extraction over the blinks the detector CAUGHT (same shape as the miss
extraction: baseline frames with insideSpan 0, span frames with
insideSpan 1), writes the per-blink table, and prints the caught-blink
numbers beside the committed miss numbers so the two halves of the
question sit in one place.

It reads numbers, never a frame. The raw per-frame traces stay on the
machine that holds the measured folder; only the per-blink table of
numbers is meant for docs/evidence/.

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/iris_positive_control.py \
        <caught_spans.csv> --out <per_blink.csv>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from blinklab.iris_control import (
    RANGE_FLOOR,
    SOFT_FLOOR,
    IrisControlError,
    IrisControlSummary,
    per_blink_table,
    summarize,
)

MISS_SUMMARY = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "evidence"
    / "2026-09-02-awake-autopsy"
    / "iris_on_misses_summary.csv"
)


def _miss_lines(path: Path) -> list[str]:
    """The committed miss-side numbers, recomputed from the evidence table."""
    misses = pd.read_csv(path)
    in_span = misses["in_span_iris_median"].to_numpy(dtype=float)
    mins = misses["in_span_iris_min"].to_numpy(dtype=float)
    return [
        f"  misses (committed, n={len(misses)}):",
        "    in-span median (median):          "
        f"{float(np.median(in_span)):.3f}",
        f"    in-span min (median):             {float(np.median(mins)):.3f}",
        f"    misses with any frame < {RANGE_FLOOR:.2f}:    "
        f"{int(np.sum(mins < RANGE_FLOOR))} of {len(misses)}",
    ]


def _report(result: IrisControlSummary, miss_lines: list[str]) -> str:
    lines = [
        "Iris positive control (docs/iris-occlusion.txt, roadmap 10.5)",
        f"  caught blinks analyzable:           {result.n_blinks} "
        f"(dropped {result.n_dropped})",
        f"  open baseline (median):             {result.median_baseline:.3f}",
        "  in-span median (median):            "
        f"{result.median_in_span_median:.3f}",
        "  in-span min (median):               "
        f"{result.median_in_span_min:.3f}",
        f"  blinks with any frame < {RANGE_FLOOR:.2f}:     "
        f"{result.blinks_below_floor} of {result.n_blinks} "
        f"({result.share_below_floor:.1%})",
        f"  blinks with any frame < {SOFT_FLOOR:.2f}:     "
        f"{result.blinks_below_soft_floor} of {result.n_blinks}",
        *miss_lines,
        f"  VERDICT: {result.verdict.upper()}",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "spans", type=Path, help="the caught-blink span extraction"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="where to write the per-blink table (CSV)",
    )
    parser.add_argument(
        "--miss-summary",
        type=Path,
        default=MISS_SUMMARY,
        help="the committed miss-side table to print beside the control",
    )
    args = parser.parse_args()

    try:
        table = per_blink_table(pd.read_csv(args.spans))
        result = summarize(table)
    except IrisControlError as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        raise SystemExit(1) from error

    if args.out is not None:
        table.to_csv(args.out, index=False)
        print(f"per-blink table written to {args.out}")
    print(_report(result, _miss_lines(args.miss_summary)))


if __name__ == "__main__":
    main()
