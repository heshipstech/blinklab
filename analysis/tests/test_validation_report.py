"""The published round table, and whether it says which instrument it is.

Roadmap 10.1f2, ladder D6. This module produces the table the six-person
round publishes, and until now it had no test file of its own at all:
every function in it was reached only through the modules it calls, so a
change to the report's own assembly could not go red anywhere.

The specific defect these tests exist for is that a table averaging
across sessions is a table about one instrument, and nothing said
whether it was one. `app_commit` has been in every export since
remediation E2, no tool read it, and a cohort spanning a detector change
would have been published as one number with no note.
"""

import re
from pathlib import Path

from tools.validation_report import report

REPO_ROOT = Path(__file__).resolve().parents[2]
GOOD_SESSION = REPO_ROOT / "test" / "fixtures" / "verdict" / "good-session.csv"

BLINK_HEADER = (
    "startFrame,endFrame,atMs,durationMs,amplitudeMm,"
    "peakClosingVelocityMmPerS,amplitudeOverVelocityMs"
)


def stage(tmp_path: Path, stamp: str, commit: str | None = None) -> None:
    """One participant's pair, recorded by a named build or by none.

    The fixture already carries `# app_commit: dev`, so the line is
    REPLACED rather than prepended. Prepending was the first attempt
    and the loader refused the file by name for declaring one key
    twice, which is roadmap 10.16's shared reader doing its job on the
    test that was written carelessly.
    """
    text = GOOD_SESSION.read_text(encoding="utf-8")
    replacement = "" if commit is None else f"# app_commit: {commit}"
    text, replaced = re.subn(
        r"^# app_commit: dev$", replacement, text, count=1, flags=re.M
    )
    assert replaced == 1, "the fixture no longer carries an app_commit line"
    if commit is None:
        text = text.replace("\n\n", "\n", 1)
    (tmp_path / f"blinklab-session-{stamp}.csv").write_text(
        text, encoding="utf-8"
    )
    (tmp_path / f"blinklab-blinks-{stamp}.csv").write_text(
        "\r\n".join(["# source: camera", BLINK_HEADER, ",,5000,120,4.2,95,44"])
        + "\r\n",
        encoding="utf-8",
    )


class TestTheCohortSaysWhichInstrumentItIs:
    def test_one_build_is_named_in_the_header(self, tmp_path: Path) -> None:
        stage(tmp_path, "2026-08-30T10-00-00-000", "abc1234")
        stage(tmp_path, "2026-08-30T11-00-00-000", "abc1234")
        lines, _ = report(tmp_path)
        assert "All sessions were recorded by build abc1234." in lines

    def test_a_mixed_cohort_is_named_as_more_than_one(
        self, tmp_path: Path
    ) -> None:
        # The case the line exists for. Two builds in one table means
        # the average describes two instruments, and a reader has to be
        # told before they read the number, not after.
        stage(tmp_path, "2026-08-30T10-00-00-000", "abc1234")
        stage(tmp_path, "2026-08-30T11-00-00-000", "def5678")
        lines, _ = report(tmp_path)
        mixed = [line for line in lines if "different builds" in line]
        assert len(mixed) == 1
        assert "abc1234" in mixed[0] and "def5678" in mixed[0]
        assert "not one instrument" in mixed[0]

    def test_files_predating_the_stamp_say_so(self, tmp_path: Path) -> None:
        # The committed fixtures carry no app_commit, which is what
        # every export before remediation E2 looks like. Unknown is a
        # third answer, and calling it uniform or mixed would both be
        # wrong.
        stage(tmp_path, "2026-08-30T10-00-00-000")
        lines, _ = report(tmp_path)
        assert any("predate the build stamp" in line for line in lines)

    def test_the_line_sits_above_the_tables(self, tmp_path: Path) -> None:
        # A caveat printed under a table is a caveat read after the
        # number it qualifies.
        stage(tmp_path, "2026-08-30T10-00-00-000", "abc1234")
        lines, _ = report(tmp_path)
        commit_at = next(
            index
            for index, line in enumerate(lines)
            if "build abc1234" in line
        )
        checks_at = lines.index("CHECKS")
        assert commit_at < checks_at


class TestTheReportStillReportsTheRound:
    def test_it_names_the_participants_and_the_ground_truth(
        self, tmp_path: Path
    ) -> None:
        # A floor under the tests above: if report() ever stopped
        # producing a table, the assertions on one line of it would go
        # on passing against almost nothing.
        stage(tmp_path, "2026-08-30T10-00-00-000", "abc1234")
        lines, refused = report(tmp_path)
        assert refused == 0
        assert len(lines) > 10
        assert any(
            line.startswith("Validation round: 1 participant")
            for line in lines
        )
        assert "CHECKS" in lines
        assert "CONDITIONS" in lines


def stage_unreadable(tmp_path: Path, stamp: str) -> None:
    (tmp_path / f"blinklab-session-{stamp}.csv").write_text(
        "# source: camera\r\ntimestampMs\r\n1\r\n", encoding="utf-8"
    )
    (tmp_path / f"blinklab-blinks-{stamp}.csv").write_text(
        "\r\n".join(["# source: camera", BLINK_HEADER]) + "\r\n",
        encoding="utf-8",
    )


class TestARefusalIsNeverASkip:
    def test_an_unreadable_session_is_counted_and_named(
        self, tmp_path: Path
    ) -> None:
        stage(tmp_path, "2026-08-30T10-00-00-000", "abc1234")
        stage_unreadable(tmp_path, "2026-08-30T11-00-00-000")
        lines, refused = report(tmp_path)
        assert refused == 1
        assert "REFUSED" in lines
        # And the readable session's build is still named, because a
        # refusal must not take the cohort's provenance with it.
        assert "All sessions were recorded by build abc1234." in lines
