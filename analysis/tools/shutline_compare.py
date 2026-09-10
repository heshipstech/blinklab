"""Print both shut-line placements for every retained session export.

Roadmap 12.0a's floor-shift clause. The live page draws "eyes shut"
at 0.4 x a frozen open-eye baseline; the pre-registered personal rule
(docs/shut-line-rule.txt, committed first) places it at the person's
own closed value plus 0.15 x their open-to-closed span. This tool
runs both placements over retained exports (`blinklab/shutline.py`)
and prints them side by side, so the rule's predictions — including
the P80 phone trace reading nonzero under its own floor — are scored
against numbers rather than adjectives.

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/shutline_compare.py \\
        <folder-with-session-exports>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from blinklab.shutline import ShutLineError, compare_directory


def _fmt(value: float | None) -> str:
    return "  none" if value is None else f"{value:6.2f}"


def _pct(value: float | None) -> str:
    return "   none" if value is None else f"{100 * value:6.1f}%"


def _run(value: int | None) -> str:
    return "none" if value is None else str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    args = parser.parse_args()

    try:
        results = compare_directory(args.folder)
    except ShutLineError as error:
        print(f"refused: {error}", file=sys.stderr)
        return 1

    print(
        f"{'session':28}  {'open':>6}  {'closed':>6}  {'old ln':>6}  "
        f"{'new ln':>6}  {'old shut':>8}  {'new shut':>8}  "
        f"{'runs s':>9}  adopted"
    )
    for r in results:
        runs = f"{_run(r.longest_run_s_old)}/{_run(r.longest_run_s_new)}"
        print(
            f"{r.name:28}  {_fmt(r.open_proxy_mm):>6}  "
            f"{_fmt(r.closed_proxy_mm):>6}  {_fmt(r.old_line_mm):>6}  "
            f"{_fmt(r.new_line_mm):>6}  {_pct(r.perclos_old):>8}  "
            f"{_pct(r.perclos_new):>8}  {runs:>9}  "
            f"{'yes' if r.adopted else 'NO — margin under 0.6 mm'}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
