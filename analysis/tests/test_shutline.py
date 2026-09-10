"""Both shut-line placements from one retained export, pinned.

Roadmap 12.0a. The live page draws "eyes shut" at 0.4 x a frozen
open-eye baseline; the pre-registered rule (docs/shut-line-rule.txt)
re-places it personally as closed + 0.15 x (open - closed). These
tests pin the instrument that will score the rule's floor-shift
prediction on the owner's retained dry-run exports: the proxies, the
strictly-below boundary the live consumers use, the adoption margin,
and the refusals — each on synthetic sessions whose right answer is
arithmetic, not opinion.
"""

from pathlib import Path

import pytest

from blinklab.loader import COLUMNS
from blinklab.shutline import (
    ShutLineError,
    compare_directory,
    compare_session,
)

STAMP = "2026-09-10T09-00-00-000"


def a_row(
    timestamp: int,
    aperture: str = "",
    shut_baseline: str = "",
) -> str:
    values = {
        "timestampMs": str(timestamp),
        "faceDetected": "true" if aperture else "false",
        "fps": "30",
        "apertureMm": aperture,
        "shutBaselineMm": shut_baseline,
        "onScreen": "true",
    }
    return ",".join(values.get(name, "") for name in COLUMNS)


def write_session(folder: Path, rows: list[str], stamp: str = STAMP) -> Path:
    path = folder / f"blinklab-session-{stamp}.csv"
    path.write_text(
        "\n".join(["# source: camera", ",".join(COLUMNS), *rows]) + "\n",
        encoding="utf-8",
    )
    return path


def clustered_rows(
    open_mm: str,
    closed_mm: str,
    open_count: int,
    closed_count: int,
    shut_baseline: str,
    extra: list[str] | None = None,
) -> list[str]:
    """Open rows, then closed rows, then extras, one second apart."""
    apertures = (
        [open_mm] * open_count + [closed_mm] * closed_count + (extra or [])
    )
    return [
        a_row(1000 * i, aperture=a, shut_baseline=shut_baseline)
        for i, a in enumerate(apertures)
    ]


class TestThePlacement:
    def test_both_lines_from_a_clean_session(self, tmp_path: Path) -> None:
        # 98 rows at 8.0, 2 at 1.0: the median proxy reads the open
        # cluster, the 1st percentile the closed one, exactly.
        path = write_session(
            tmp_path, clustered_rows("8.0", "1.0", 98, 2, "8.2")
        )
        result = compare_session(path)
        assert result.open_proxy_mm == 8.0
        assert result.closed_proxy_mm == 1.0
        # closed + 0.15 x span = 1.0 + 0.15 x 7.0
        assert result.new_line_mm == pytest.approx(2.05)
        # The shipped rule: 0.4 x the frozen baseline.
        assert result.old_line_mm == pytest.approx(3.28)
        # 0.15 x 7.0 = 1.05 mm clears the 0.6 mm margin.
        assert result.adopted is True

    def test_the_margin_gate_refuses_a_small_span(
        self, tmp_path: Path
    ) -> None:
        # Span 1.0 mm buys a 0.15 mm margin, under the 0.6 the noise
        # floor demands: not adopted — but both numbers still report,
        # because the adoption verdict is its own fact, not a censor.
        path = write_session(
            tmp_path, clustered_rows("3.0", "2.0", 98, 2, "3.0")
        )
        result = compare_session(path)
        assert result.adopted is False
        assert result.perclos_new is not None

    def test_exactly_at_the_line_stays_open(self, tmp_path: Path) -> None:
        # The live consumers close strictly below the line ("exactly
        # at it stays open", perclos.ts); the instrument must count
        # the same way or its numbers are about a different rule.
        # closed 1.0, open 9.0: new line at 1.0 + 0.15 x 8.0 = 2.20.
        rows = clustered_rows("9.0", "1.0", 96, 2, "9.0", extra=["2.2", "2.2"])
        result = compare_session(write_session(tmp_path, rows))
        assert result.new_line_mm == pytest.approx(2.2)
        # Only the two 1.0 rows are below the line; the 2.2 rows are
        # AT it and stay open.
        assert result.perclos_new == pytest.approx(2 / 100)


class TestTheComparison:
    def test_the_two_lines_disagree_where_they_should(
        self, tmp_path: Path
    ) -> None:
        # closed 1.0 / open 9.0: new line 2.20, old line 0.4 x 9.0 =
        # 3.60. Three hover rows at 3.0 sit between the lines: shut
        # to the old rule, open to the personal one.
        rows = clustered_rows(
            "9.0", "1.0", 95, 2, "9.0", extra=["3.0", "3.0", "3.0"]
        )
        result = compare_session(write_session(tmp_path, rows))
        assert result.perclos_old == pytest.approx(5 / 100)
        assert result.perclos_new == pytest.approx(2 / 100)

    def test_the_p80_shape_reads_nonzero_under_its_own_floor(
        self, tmp_path: Path
    ) -> None:
        # The named dry-run failure: a baseline frozen wrong-low puts
        # the population line at 0.4 x 1.2 = 0.48 mm, under every
        # aperture the eye can produce, and a heavy droop counts as
        # nothing. The personal line, anchored at the person's own
        # closed value plus a funded margin, starts counting.
        rows = clustered_rows("8.0", "1.0", 90, 5, "1.2", extra=["1.5"] * 5)
        result = compare_session(write_session(tmp_path, rows))
        assert result.perclos_old == 0.0
        assert result.perclos_new == pytest.approx(10 / 100)

    def test_the_longest_run_is_consecutive_not_total(
        self, tmp_path: Path
    ) -> None:
        # Below-line seconds: two runs, lengths 2 and 3, split by an
        # open second. Total is 5; the longest RUN is 3, and a
        # duration proxy that added the runs together would be the
        # dilution defect wearing a new column.
        apertures = ["8.0"] * 93 + [
            "1.0",
            "1.0",
            "8.0",
            "1.0",
            "1.0",
            "1.0",
            "8.0",
        ]
        rows = [
            a_row(1000 * i, aperture=a, shut_baseline="8.0")
            for i, a in enumerate(apertures)
        ]
        result = compare_session(write_session(tmp_path, rows))
        assert result.longest_run_s_new == 3
        assert result.longest_run_s_old == 3


class TestTheRefusals:
    def test_no_measured_aperture_refuses_by_name(
        self, tmp_path: Path
    ) -> None:
        rows = [a_row(1000 * i) for i in range(30)]
        with pytest.raises(ShutLineError, match="no measured aperture"):
            compare_session(write_session(tmp_path, rows))

    def test_a_varying_frozen_baseline_refuses(self, tmp_path: Path) -> None:
        # shutBaselineMm freezes once per session by contract; two
        # distinct values is instrument damage, not a choice.
        rows = clustered_rows("8.0", "1.0", 50, 2, "8.2") + [
            a_row(999000, aperture="8.0", shut_baseline="7.9")
        ]
        with pytest.raises(ShutLineError, match="frozen"):
            compare_session(write_session(tmp_path, rows))

    def test_a_session_that_never_froze_reports_no_old_line(
        self, tmp_path: Path
    ) -> None:
        # An empty shutBaselineMm column is age or an early stop, not
        # damage: the old rule never placed a line there, and None
        # says so where a zero would claim a measurement.
        path = write_session(tmp_path, clustered_rows("8.0", "1.0", 98, 2, ""))
        result = compare_session(path)
        assert result.old_line_mm is None
        assert result.perclos_old is None
        assert result.longest_run_s_old is None
        assert result.new_line_mm == pytest.approx(2.05)

    def test_a_flat_session_has_no_span_to_place_in(
        self, tmp_path: Path
    ) -> None:
        path = write_session(
            tmp_path, clustered_rows("5.0", "5.0", 60, 2, "5.0")
        )
        with pytest.raises(ShutLineError, match="span"):
            compare_session(path)


class TestTheDirectory:
    def test_every_session_reports_sorted_by_name(
        self, tmp_path: Path
    ) -> None:
        write_session(
            tmp_path,
            clustered_rows("8.0", "1.0", 98, 2, "8.2"),
            stamp="2026-09-10T09-00-00-000",
        )
        write_session(
            tmp_path,
            clustered_rows("9.0", "1.0", 96, 2, "9.0"),
            stamp="2026-09-10T10-00-00-000",
        )
        results = compare_directory(tmp_path)
        assert [r.name for r in results] == sorted(r.name for r in results)
        assert len(results) == 2

    def test_an_empty_directory_refuses(self, tmp_path: Path) -> None:
        with pytest.raises(ShutLineError, match="no session"):
            compare_directory(tmp_path)
