"""The page's account of the ruler-fit check, held to a recomputation.

Since 23 August 2026 the browser computes the validation round's
fifth check live and writes the ratio into every row. Two
implementations of one check drift silently unless something compares
them, and this is the comparison: the last value the page claimed
must equal this tool's own derivation from the same rows, to the
last bit. These tests pin what "compare" means — the LAST value, an
EXACT equality, and honest silence for files that predate the column.
"""

from pathlib import Path

from blinklab.loader import COLUMNS, LEGACY_COLUMNS, load_session
from blinklab.ruler_fit import ruler_fit_cross_check

STAMP = "2026-08-23T09-00-00-000"


def a_row(
    timestamp: int,
    aperture: str = "7.0",
    baseline: str = "",
    over_resting: str = "",
) -> str:
    cells = [str(timestamp), "true", "60", aperture, baseline] + [""] * 6
    cells += ["0", "", "", "", "true", over_resting]
    return ",".join(cells)


def write_session(folder: Path, rows: list[str], header: str = "") -> Path:
    path = folder / f"blinklab-session-{STAMP}.csv"
    path.write_text(
        "\n".join(["# source: camera", header or ",".join(COLUMNS), *rows])
        + "\n",
        encoding="utf-8",
    )
    return path


class TestTheComparison:
    def test_agrees_when_the_file_carries_what_the_tool_derives(
        self, tmp_path: Path
    ) -> None:
        # Baseline 7.44 born on row 2; apertures 5.8, 6.0, 6.2, 6.0
        # median 6.0; ratio exactly 7.44 / 6.0 = 1.24. The page wrote
        # the same number, so the two accounts agree.
        rows = [
            a_row(1000, "5.8"),
            a_row(2000, "6.0", "7.44", "1.24"),
            a_row(3000, "6.2", "7.44", "1.24"),
            a_row(4000, "6.0", "7.44", "1.24"),
        ]
        frame = load_session(write_session(tmp_path, rows)).frame
        check = ruler_fit_cross_check(frame)
        assert check.page_ratio == 1.24
        assert check.recomputed_ratio == 1.24
        assert check.agrees is True

    def test_the_equality_survives_full_float_precision(
        self, tmp_path: Path
    ) -> None:
        # 7.44 / 6.1 has no short decimal form. The page writes the
        # shortest round-tripping decimal (JavaScript's String, the
        # same family as Python's repr), so the parsed value must be
        # the identical float64 and the comparison must hold EXACTLY.
        # If this test fails, the CSV parser is not round-trip safe
        # and the module must say so instead of using ==.
        expected = 7.44 / 6.1
        rows = [
            a_row(1000, "6.1"),
            a_row(2000, "6.1", "7.44", repr(expected)),
        ]
        frame = load_session(write_session(tmp_path, rows)).frame
        check = ruler_fit_cross_check(frame)
        assert check.page_ratio == expected
        assert check.recomputed_ratio == expected
        assert check.agrees is True

    def test_a_doctored_account_disagrees(self, tmp_path: Path) -> None:
        # The true ratio is 7.44 / 6.1 = 1.2196..., and the page
        # claims 1.22. To two decimals they are the same number,
        # which is exactly why the comparison must not round: two
        # wrong implementations can agree to two decimals.
        rows = [
            a_row(1000, "6.1"),
            a_row(2000, "6.1", "7.44", "1.22"),
        ]
        frame = load_session(write_session(tmp_path, rows)).frame
        check = ruler_fit_cross_check(frame)
        assert check.agrees is False

    def test_the_last_value_speaks_not_the_first(self, tmp_path: Path) -> None:
        # The running ratio changes as the median converges, so early
        # rows legitimately differ from the final statistic. Only the
        # last row is the whole-file number the published check
        # computes.
        # The early row carries 1.9, a value the final statistic is
        # nowhere near, so reading the FIRST value instead of the
        # last cannot slip through as a coincidence.
        rows = [
            a_row(1000, "6.0"),
            a_row(2000, "6.2", "7.44", "1.9"),
            a_row(3000, "6.2", "7.44", repr(7.44 / 6.2)),
        ]
        frame = load_session(write_session(tmp_path, rows)).frame
        check = ruler_fit_cross_check(frame)
        assert check.page_ratio == 7.44 / 6.2
        assert check.agrees is True

    def test_a_file_from_before_the_column_is_not_comparable(
        self, tmp_path: Path
    ) -> None:
        # A legacy export never computed the ratio, so there is no
        # page account to hold to anything: agrees is None, never a
        # False that would read as a finding against a session that
        # predates the feature.
        legacy = [
            row.rsplit(",", 1)[0]
            for row in [a_row(1000, "6.0"), a_row(2000, "6.0", "7.44")]
        ]
        frame = load_session(
            write_session(tmp_path, legacy, header=",".join(LEGACY_COLUMNS))
        ).frame
        check = ruler_fit_cross_check(frame)
        assert check.page_ratio is None
        assert check.agrees is None

    def test_a_claim_the_tool_cannot_derive_disagrees(
        self, tmp_path: Path
    ) -> None:
        # The page wrote a ratio into a file whose baseline column is
        # empty. Live, the two are computed on the same tick from the
        # same state, so this shape means one side is broken, and it
        # must read as a disagreement rather than a shrug.
        rows = [
            a_row(1000, "6.0", "", "1.24"),
            a_row(2000, "6.0", "", "1.24"),
        ]
        frame = load_session(write_session(tmp_path, rows)).frame
        check = ruler_fit_cross_check(frame)
        assert check.page_ratio == 1.24
        assert check.recomputed_ratio is None
        assert check.agrees is False


class TestTheReportSection:
    def test_the_report_states_the_agreement(self, tmp_path: Path) -> None:
        from tools.validation_report import report

        rows = [
            a_row(1000, "6.0"),
            a_row(2000, "6.0", "7.44", "1.24"),
            a_row(3000, "6.0", "7.44", "1.24"),
        ]
        write_session(tmp_path, rows)
        text = "\n".join(report(tmp_path)[0])
        assert (
            "page's own ruler-fit account matches this tool's "
            "recomputation exactly on the 1 session that carries it" in text
        )
        assert "1 sessions" not in text

    def test_the_report_shouts_a_disagreement_with_full_precision(
        self, tmp_path: Path
    ) -> None:
        from tools.validation_report import report

        rows = [
            a_row(1000, "6.1"),
            a_row(2000, "6.1", "7.44", "1.22"),
        ]
        write_session(tmp_path, rows)
        text = "\n".join(report(tmp_path)[0])
        assert "THE PAGE DISAGREES WITH THIS TOOL" in text
        # Full precision, because to two decimals these two are the
        # same number and the section exists precisely to see past
        # that.
        assert "1.22" in text
        assert repr(7.44 / 6.1) in text

    def test_a_round_of_legacy_files_says_nothing(
        self, tmp_path: Path
    ) -> None:
        from tools.validation_report import report

        legacy = [
            row.rsplit(",", 1)[0]
            for row in [a_row(1000, "6.0"), a_row(2000, "6.0", "7.44")]
        ]
        write_session(tmp_path, legacy, header=",".join(LEGACY_COLUMNS))
        text = "\n".join(report(tmp_path)[0])
        assert "ruler-fit account" not in text
        assert "PAGE DISAGREES" not in text
