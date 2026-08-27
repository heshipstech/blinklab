"""Are two runs missing the same blinks? The identity join.

The question and its predictions are docs/miss-character.txt,
committed before this tool existed. Every published reproduction
compares counts; this joins two committed miss tables on
(clip, blink_id) — the corpus annotation's own identity — and says
which misses are shared, which belong to one run only, and what
share of each group contains a frame the human marked fully closed.

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/miss_overlap.py \\
        <first_misses.csv> <second_misses.csv>
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class MissOverlap:
    first_count: int
    second_count: int
    shared_count: int
    only_first_count: int
    only_second_count: int
    # The fully-closed-frame share of each group, or None for an
    # empty group: a share over nothing is not zero.
    shared_closed_share: float | None
    only_first_closed_share: float | None
    only_second_closed_share: float | None


def _read(path: Path) -> dict[tuple[str, str], bool]:
    """One run's misses: identity -> whether a closed frame exists.

    A duplicated identity refuses: one blink cannot be missed twice
    in one run, so a duplicate means the table is damaged, and
    counting it once silently would hide that.
    """
    misses: dict[tuple[str, str], bool] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["clip"], row["blink_id"])
            if key in misses:
                raise ValueError(
                    f"{path.name}: {key[0]} blink {key[1]} appears "
                    f"twice, and one blink cannot be missed twice in "
                    f"one run — the table is damaged"
                )
            misses[key] = int(row["fullyClosedFrames"]) > 0
    return misses


def _share(flags: list[bool]) -> float | None:
    return None if not flags else sum(flags) / len(flags)


def compare_miss_tables(first_path: Path, second_path: Path) -> MissOverlap:
    first = _read(first_path)
    second = _read(second_path)
    shared = sorted(first.keys() & second.keys())
    only_first = sorted(first.keys() - second.keys())
    only_second = sorted(second.keys() - first.keys())
    return MissOverlap(
        first_count=len(first),
        second_count=len(second),
        shared_count=len(shared),
        only_first_count=len(only_first),
        only_second_count=len(only_second),
        shared_closed_share=_share([first[key] for key in shared]),
        only_first_closed_share=_share([first[key] for key in only_first]),
        only_second_closed_share=_share([second[key] for key in only_second]),
    )


def _pct(share: float | None) -> str:
    return "-" if share is None else f"{share * 100:.1f}%"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first", type=Path)
    parser.add_argument("second", type=Path)
    arguments = parser.parse_args()
    result = compare_miss_tables(arguments.first, arguments.second)
    print(f"first   {result.first_count} misses ({arguments.first})")
    print(f"second  {result.second_count} misses ({arguments.second})")
    print(
        f"shared       {result.shared_count}, closed-frame share "
        f"{_pct(result.shared_closed_share)}"
    )
    print(
        f"only first   {result.only_first_count}, closed-frame share "
        f"{_pct(result.only_first_closed_share)}"
    )
    print(
        f"only second  {result.only_second_count}, closed-frame share "
        f"{_pct(result.only_second_closed_share)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
