"""The pilot researcher additions, increment 9 of the ladder.

Three duties, each held by test: round I's output stays byte-frozen
while the pilot lands beside it; the pilot table re-derives every
session's verdict from primary facts and prints NO recall figure and
NO score aggregate; and a session whose exported report file
disagrees with the re-derivation is an INSTRUMENT DEFECT that stops
the cohort analysis — the round II precedent, not a per-row shrug.

The match and defect cases run on the COMMITTED fixtures from
increments 5 and 7: test/fixtures/verdict/good-session.csv is the
session, test/fixtures/report/good-report.txt is the page's own
rendering of the same verdict, so the comparison in these tests is
the real cross-language comparison, not a staged imitation.
"""

import shutil
from pathlib import Path

import pytest

from blinklab.loader import load_session
from blinklab.pilot import (
    REPORT_PREFIX,
    InstrumentDefect,
    pilot_verdict_lines,
    verdict_section_lines,
)
from blinklab.validation import ValidationError, find_pairs
from blinklab.verdict import derive_verdict

REPO_ROOT = Path(__file__).resolve().parents[2]
GOOD_SESSION = REPO_ROOT / "test" / "fixtures" / "verdict" / "good-session.csv"
GOOD_REPORT = REPO_ROOT / "test" / "fixtures" / "report" / "good-report.txt"

BLINK_HEADER = (
    "startFrame,endFrame,atMs,durationMs,amplitudeMm,"
    "peakClosingVelocityMmPerS,amplitudeOverVelocityMs"
)
STAMP = "2026-08-30T10-00-00-000"


def stage_good_pair(tmp_path: Path, with_report: bool = True) -> Path:
    shutil.copy(GOOD_SESSION, tmp_path / f"blinklab-session-{STAMP}.csv")
    (tmp_path / f"blinklab-blinks-{STAMP}.csv").write_text(
        "\r\n".join(["# source: camera", BLINK_HEADER, ",,5000,120,4.2,95,44"])
        + "\r\n",
        encoding="utf-8",
    )
    if with_report:
        shutil.copy(GOOD_REPORT, tmp_path / f"blinklab-report-{STAMP}.txt")
    return tmp_path


class TestTheStrayPolicyStaysFrozen:
    def test_round_one_still_refuses_a_report_file_as_a_stray(
        self, tmp_path: Path
    ) -> None:
        # Round I never produced report files, so one in a round I
        # folder is still a renamed or misplaced file and the round
        # still refuses whole — the frozen behaviour, untouched.
        stage_good_pair(tmp_path)
        with pytest.raises(ValidationError, match="not exports"):
            find_pairs(tmp_path)

    def test_pilot_mode_pairs_the_report_by_stamp(
        self, tmp_path: Path
    ) -> None:
        stage_good_pair(tmp_path)
        pairs = find_pairs(tmp_path, pilot_reports=True)
        assert len(pairs) == 1
        report_path = pairs[0].report_path
        assert report_path is not None
        assert report_path.name == f"{REPORT_PREFIX}{STAMP}.txt"

    def test_an_orphan_report_is_refused_not_skipped(
        self, tmp_path: Path
    ) -> None:
        stage_good_pair(tmp_path)
        (tmp_path / f"{REPORT_PREFIX}2026-08-30T11-00-00-000.txt").write_text(
            "orphan", encoding="utf-8"
        )
        with pytest.raises(ValidationError, match="report"):
            find_pairs(tmp_path, pilot_reports=True)


class TestTheCrossLanguagePin:
    def test_the_rebuilt_section_lines_are_the_pages_own(self) -> None:
        # The defect check rebuilds "STATUS — surface: sentence" lines
        # from the re-derived verdict and looks for them in the page's
        # exported report. Both sides here are committed fixtures: the
        # verdict derives from increment 5's session CSV, the report
        # is increment 7's snapshot of the SAME session, so every
        # rebuilt line must already sit in that file verbatim.
        verdict = derive_verdict(load_session(GOOD_SESSION))
        report_text = GOOD_REPORT.read_text(encoding="utf-8")
        lines = verdict_section_lines(verdict)
        assert len(lines) == 8
        for line in lines:
            assert line in report_text


class TestTheDefectGate:
    def test_a_matching_report_raises_nothing(self, tmp_path: Path) -> None:
        stage_good_pair(tmp_path)
        lines = pilot_verdict_lines(find_pairs(tmp_path, pilot_reports=True))
        assert any("P1" in line for line in lines)

    def test_a_disagreeing_report_is_an_instrument_defect(
        self, tmp_path: Path
    ) -> None:
        stage_good_pair(tmp_path)
        report_file = tmp_path / f"{REPORT_PREFIX}{STAMP}.txt"
        text = report_file.read_text(encoding="utf-8")
        assert "stayed visible throughout" in text
        report_file.write_text(
            text.replace(
                "The page stayed visible throughout the measurement.",
                "The page was hidden twice during the measurement.",
            ),
            encoding="utf-8",
        )
        with pytest.raises(InstrumentDefect, match="interruptions"):
            pilot_verdict_lines(find_pairs(tmp_path, pilot_reports=True))

    def test_a_missing_report_is_not_a_defect(self, tmp_path: Path) -> None:
        # A session whose report was never exported has nothing to
        # disagree with; the row says so rather than inventing one.
        stage_good_pair(tmp_path, with_report=False)
        lines = pilot_verdict_lines(find_pairs(tmp_path, pilot_reports=True))
        assert any("no report file" in line for line in lines)


class TestTheRestraint:
    def test_the_pilot_table_prints_no_recall_and_no_score(
        self, tmp_path: Path
    ) -> None:
        # The plan's restraint: no recall figure published from six
        # volunteers, and the score never aggregates — an unvalidated
        # heuristic must not acquire a cohort mean by accident.
        stage_good_pair(tmp_path)
        text = "\n".join(
            pilot_verdict_lines(find_pairs(tmp_path, pilot_reports=True))
        )
        assert "recall" not in text.lower()
        assert "score" not in text.lower()
        assert "ok" in text.lower()


class TestRoundOneStaysByteFrozen:
    def test_the_round_one_report_is_byte_identical_to_its_fixture(
        self, tmp_path: Path
    ) -> None:
        # Round I's published tables must stay reproducible, so its
        # OUTPUT is frozen here, byte for byte, over a deterministic
        # synthetic pair — any pilot-era change that touches round I's
        # rendering goes red on this test instead of shipping quietly.
        # The first line carries the temp directory's path and is
        # asserted by shape; everything after it is frozen whole.
        import sys

        sys.path.insert(0, str(REPO_ROOT / "analysis" / "tools"))
        from validation_report import report

        stage_good_pair(tmp_path, with_report=False)
        lines, refused = report(tmp_path, "round1")
        assert lines[0].startswith("Validation round: 1 participant in ")
        frozen = (
            Path(__file__).parent / "fixtures" / "round1_report_frozen.txt"
        )
        assert "\n".join(lines[1:]) + "\n" == frozen.read_text(
            encoding="utf-8"
        )
        assert refused == 0
