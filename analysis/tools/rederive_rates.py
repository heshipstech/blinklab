"""Print the RLDD blink rate both ways: as published, and re-derived.

Roadmap 10.12b's third Check clause. The retained per-second files
carry the rate the app computed when they were exported — a rolling
count over the wall clock — and 10.12b changed the live definition to
divide by observed time. This tool re-derives each video's rate from
what the retained files already hold (blink events over observed
window seconds, `blinklab/rederive.py`) and prints it beside the
published derivation, so the result file's caveat can name the change
with numbers instead of adjectives. DROZY is deliberately absent:
its rate never read the rolling column (see the module docstring).

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/rederive_rates.py \\
        <rldd-measured-dir>
"""

from __future__ import annotations

import argparse
import statistics
import sys
from pathlib import Path

from blinklab.rederive import RederiveError, rederive_directory


def _fmt(value: float | None) -> str:
    return "refused" if value is None else f"{value:6.2f}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("measured_dir", type=Path)
    args = parser.parse_args()

    try:
        results = rederive_directory(args.measured_dir)
    except RederiveError as error:
        print(f"refused: {error}", file=sys.stderr)
        return 1

    print(
        f"{'video':32}  {'old rate':>8}  {'new rate':>8}  "
        f"{'blinks':>6}  {'observed s':>10}"
    )
    for r in results:
        print(
            f"{r.name:32}  {_fmt(r.old_rate_per_min):>8}  "
            f"{_fmt(r.new_rate_per_min):>8}  {r.blink_count:>6}  "
            f"{r.observed_seconds:>10}"
        )

    olds = [
        r.old_rate_per_min for r in results if r.old_rate_per_min is not None
    ]
    news = [
        r.new_rate_per_min for r in results if r.new_rate_per_min is not None
    ]
    if olds and news:
        print(
            f"\nmedians over {len(results)} videos: "
            f"old {statistics.median(olds):.2f}, "
            f"new {statistics.median(news):.2f} per minute"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
