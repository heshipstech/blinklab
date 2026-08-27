"""The miss identity join, held to docs/miss-character.txt.

Watched failing before analysis/tools/miss_overlap.py existed. The
tool answers one question — are two runs missing the same blinks —
so these tests pin the join key, the set arithmetic, and the
closed-frame share of each group, on synthetic tables where every
answer is hand-checkable.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from miss_overlap import MissOverlap, compare_miss_tables  # noqa: E402

HEADER = "clip,blink_id,startFrame,endFrame,frameLength,fullyClosedFrames"


def table(tmp_path: Path, name: str, rows: list[str]) -> Path:
    path = tmp_path / name
    path.write_text("\n".join([HEADER, *rows]) + "\n", encoding="utf-8")
    return path


class TestTheJoin:
    def test_counts_shared_and_unique_misses_by_identity(
        self, tmp_path: Path
    ) -> None:
        # clip A blink 1 is shared; clip A blink 2 only in the first
        # run; clip B blink 1 only in the second. The identity is
        # (clip, blink_id): clip B's blink 1 must not match clip A's.
        first = table(
            tmp_path,
            "first.csv",
            ["clipA,1,10,17,8,3", "clipA,2,50,56,7,0"],
        )
        second = table(
            tmp_path,
            "second.csv",
            ["clipA,1,10,17,8,3", "clipB,1,10,17,8,4"],
        )
        result = compare_miss_tables(first, second)
        assert isinstance(result, MissOverlap)
        assert result.first_count == 2
        assert result.second_count == 2
        assert result.shared_count == 1
        assert result.only_first_count == 1
        assert result.only_second_count == 1

    def test_closed_frame_share_per_group(self, tmp_path: Path) -> None:
        # Shared: one closed-frame miss of two -> 0.5. Only-second:
        # one of one -> 1.0. A share over an empty group is None,
        # never zero.
        first = table(
            tmp_path,
            "first.csv",
            ["clipA,1,10,17,8,3", "clipA,2,50,56,7,0"],
        )
        second = table(
            tmp_path,
            "second.csv",
            [
                "clipA,1,10,17,8,3",
                "clipA,2,50,56,7,0",
                "clipB,9,10,17,8,4",
            ],
        )
        result = compare_miss_tables(first, second)
        assert result.shared_closed_share == 0.5
        assert result.only_second_closed_share == 1.0
        assert result.only_first_closed_share is None

    def test_identical_tables_are_identical_sets(self, tmp_path: Path) -> None:
        rows = ["clipA,1,10,17,8,3", "clipB,4,90,99,10,7"]
        first = table(tmp_path, "first.csv", rows)
        second = table(tmp_path, "second.csv", rows)
        result = compare_miss_tables(first, second)
        assert result.shared_count == 2
        assert result.only_first_count == 0
        assert result.only_second_count == 0

    def test_a_duplicate_identity_refuses(self, tmp_path: Path) -> None:
        # One blink cannot be missed twice in one run: a duplicated
        # (clip, blink_id) means the table is damaged, and counting
        # it once silently would hide that.
        import pytest

        first = table(
            tmp_path,
            "first.csv",
            ["clipA,1,10,17,8,3", "clipA,1,10,17,8,3"],
        )
        second = table(tmp_path, "second.csv", ["clipA,1,10,17,8,3"])
        with pytest.raises(ValueError, match="clipA"):
            compare_miss_tables(first, second)
