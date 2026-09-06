"""What the loader must refuse, and why each refusal earns its place.

A loader that half succeeds is worse than one that fails: the plot
still draws, the statistic still prints, and nobody re-derives either
by hand. So every malformed shape here gets a named error.
"""

from pathlib import Path

import pandas as pd
import pytest

from blinklab.loader import (
    COLUMNS,
    LEGACY_COLUMNS,
    PRE_PUPIL_COLUMNS,
    SessionError,
    cohort_commit_line,
    cohort_commits,
    load_session,
)

FIXTURE = Path(__file__).parent / "fixtures" / "session-fixture.csv"
HEADER = ",".join(COLUMNS)
LEGACY_HEADER = ",".join(LEGACY_COLUMNS)
PRE_PUPIL_HEADER = ",".join(PRE_PUPIL_COLUMNS)


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "session.csv"
    path.write_text(text, encoding="utf-8")
    return path


def a_row(timestamp: int = 1000) -> str:
    """One valid row: a face, an aperture, and nothing else measured."""
    cells = [str(timestamp), "true", "60", "7.0"] + [""] * 7
    cells += ["0", "", "", "", "", "", ""]
    return ",".join(cells)


class TestARealRecording:
    def test_loads_the_owners_own_session(self) -> None:
        session = load_session(FIXTURE)
        assert len(session.frame) == 57
        assert list(session.frame.columns) == COLUMNS

    def test_recovers_the_labels_from_the_comment_block(self) -> None:
        # The only labels a session carries live above the header,
        # where pandas would skip them silently.
        session = load_session(FIXTURE)
        assert session.metadata["kss_before"].startswith("6")
        assert session.metadata["kss_after"].startswith("6")

    def test_measures_duration_from_timestamps_not_row_count(self) -> None:
        # The browser writes about one row per second, not exactly
        # one, so counting rows drifts by roughly a minute per hour.
        session = load_session(FIXTURE)
        assert session.duration_s == pytest.approx(56.0, abs=1.0)
        assert len(session.frame) != int(session.duration_s)

    def test_an_empty_cell_is_not_measured_not_zero(self) -> None:
        # The contract's central rule, carried across the border.
        session = load_session(FIXTURE)
        assert session.frame["perclos"].isna().any()
        assert not (session.frame["perclos"].fillna(-1) == 0).all()

    def test_booleans_arrive_as_booleans(self) -> None:
        session = load_session(FIXTURE)
        assert session.frame["faceDetected"].dtype == "boolean"
        assert bool(session.frame["faceDetected"].iloc[0]) is True


class TestThePreviousGenerationOfTheHeader:
    """Files written before baselineOverResting existed still load.

    The validation round's six files, the dry run's and everything in
    docs/evidence carry the 16-column header, and the published
    tables must stay reproducible from them. The rule is an exact
    known generation, never "any subset": one column dropped from the
    MIDDLE is still a refusal.
    """

    def test_a_legacy_header_loads(self, tmp_path: Path) -> None:
        legacy_row = a_row().rsplit(",", 2)[0]
        text = f"{LEGACY_HEADER}\r\n{legacy_row}\r\n"
        session = load_session(write(tmp_path, text))
        assert list(session.frame.columns) == COLUMNS

    def test_the_unmeasured_column_arrives_as_nan_not_zero(
        self, tmp_path: Path
    ) -> None:
        legacy_row = a_row().rsplit(",", 2)[0]
        text = f"{LEGACY_HEADER}\r\n{legacy_row}\r\n"
        session = load_session(write(tmp_path, text))
        assert session.frame["baselineOverResting"].isna().all()

    def test_a_legacy_row_count_is_judged_by_its_own_header(
        self, tmp_path: Path
    ) -> None:
        # An 18-field row under a 16-column header is a broken file,
        # not a file from the future.
        text = f"{LEGACY_HEADER}\r\n{a_row()}\r\n"
        with pytest.raises(SessionError, match="row 2 has 18 fields"):
            load_session(write(tmp_path, text))

    def test_a_pre_pupil_header_loads_with_the_pupil_column_nan(
        self, tmp_path: Path
    ) -> None:
        # The generation after baselineOverResting but before the pupil
        # column (4 September 2026): it loads, and pupilDiameterMm arrives
        # as NaN because that column was not written.
        pre_pupil_row = a_row().rsplit(",", 1)[0]
        text = f"{PRE_PUPIL_HEADER}\r\n{pre_pupil_row}\r\n"
        session = load_session(write(tmp_path, text))
        assert list(session.frame.columns) == COLUMNS
        assert session.frame["pupilDiameterMm"].isna().all()


class TestWhatItRefuses:
    def test_a_file_that_is_not_there(self, tmp_path: Path) -> None:
        with pytest.raises(SessionError, match="no such file"):
            load_session(tmp_path / "absent.csv")

    def test_an_empty_file(self, tmp_path: Path) -> None:
        with pytest.raises(SessionError, match="no header"):
            load_session(write(tmp_path, ""))

    def test_a_header_with_no_rows(self, tmp_path: Path) -> None:
        # A header alone claims a recording that did not happen, the
        # same thing the exporter refuses to write.
        with pytest.raises(SessionError, match="did not happen"):
            load_session(write(tmp_path, HEADER + "\r\n"))

    def test_a_missing_column(self, tmp_path: Path) -> None:
        short = ",".join(name for name in COLUMNS if name != "perclos")
        with pytest.raises(SessionError, match="missing columns: perclos"):
            load_session(write(tmp_path, short + "\r\n"))

    def test_an_unknown_column(self, tmp_path: Path) -> None:
        with pytest.raises(SessionError, match="unknown columns: pupilMm"):
            load_session(write(tmp_path, HEADER + ",pupilMm\r\n"))

    def test_columns_in_the_wrong_order(self, tmp_path: Path) -> None:
        # Same names, shuffled: every value would land in the wrong
        # column and nothing else would notice.
        swapped = COLUMNS.copy()
        swapped[0], swapped[1] = swapped[1], swapped[0]
        with pytest.raises(SessionError, match="wrong order"):
            load_session(write(tmp_path, ",".join(swapped) + "\r\n"))

    def test_a_row_with_the_wrong_number_of_fields(
        self, tmp_path: Path
    ) -> None:
        text = f"{HEADER}\r\n{a_row()}\r\n1,2,3\r\n"
        with pytest.raises(SessionError, match="row 3 has 3 fields"):
            load_session(write(tmp_path, text))

    def test_timestamps_out_of_order(self, tmp_path: Path) -> None:
        text = f"{HEADER}\r\n{a_row(2000)}\r\n{a_row(1000)}\r\n"
        with pytest.raises(SessionError, match="not in order"):
            load_session(write(tmp_path, text))

    def test_it_accepts_the_minimal_valid_file(self, tmp_path: Path) -> None:
        # The negative control for all of the above: the smallest
        # thing that IS a session must load without complaint.
        text = f"{HEADER}\r\n{a_row(1000)}\r\n{a_row(2000)}\r\n"
        session = load_session(write(tmp_path, text))
        assert len(session.frame) == 2
        assert isinstance(session.frame, pd.DataFrame)


def a_row_with(timestamp: int = 1000, **cells: str) -> str:
    """A valid row with named cells overridden, for corrupting one."""
    values = dict(zip(COLUMNS, a_row(timestamp).split(","), strict=True))
    values.update(cells)
    return ",".join(values[name] for name in COLUMNS)


class TestACorruptCell:
    """Probes A to E and H of docs/validation-tool-adversarial.txt.

    Before these tests, one unparseable cell in one participant's file
    crashed the whole validation report with a traceback, because the
    loader's own checks stopped at field counts and timestamp order,
    and the crash arrived later, inside a check, as a bare pandas
    error that no caller catches. A corrupt cell must instead cost a
    named refusal that says which column cannot be trusted.
    """

    def refuse(self, tmp_path: Path, row: str, match: str) -> None:
        text = f"{HEADER}\r\n{a_row(1000)}\r\n{row}\r\n"
        with pytest.raises(SessionError, match=match):
            load_session(write(tmp_path, text))

    def test_a_word_where_the_rate_should_be(self, tmp_path: Path) -> None:
        self.refuse(tmp_path, a_row_with(2000, fps="fast"), "fps")

    def test_a_letter_o_in_a_baseline(self, tmp_path: Path) -> None:
        self.refuse(tmp_path, a_row_with(2000, baselineMm="7.O"), "baselineMm")

    def test_a_word_in_the_closure_counter(self, tmp_path: Path) -> None:
        self.refuse(
            tmp_path,
            a_row_with(2000, longClosureCount="two"),
            "longClosureCount",
        )

    def test_a_boolean_that_is_neither(self, tmp_path: Path) -> None:
        self.refuse(
            tmp_path, a_row_with(2000, faceDetected="maybe"), "faceDetected"
        )

    def test_a_hash_inside_a_cell_is_not_a_comment(
        self, tmp_path: Path
    ) -> None:
        # Probe H. The pre-check reads lines and skips the ones that
        # START with a hash; pandas was reading with comment="#", which
        # cuts a line at a hash anywhere in it. The two readers saw
        # different files, and the difference was silent: the row's
        # tail became NaN and a working baseline read as never ready.
        # Both readers now see the same lines, so a hash inside a cell
        # is just a character that fails the numeric check.
        self.refuse(
            tmp_path, a_row_with(2000, apertureMm="7.0#x"), "apertureMm"
        )

    def test_a_byte_order_mark_is_named(self, tmp_path: Path) -> None:
        # Probe I. Excel's "CSV UTF-8" save adds one. The file was
        # already refused, but the message listed every column as
        # missing, which sends the reader hunting for a column problem
        # that is not there. Still a refusal, deliberately: a file that
        # has been through Excel may be damaged in ways the mark merely
        # advertises.
        text = (
            "\ufeff# source: camera\r\n" + HEADER + "\r\n" + a_row() + "\r\n"
        )
        with pytest.raises(SessionError, match="byte order mark"):
            load_session(write(tmp_path, text))

    def test_a_metadata_key_declared_twice(self, tmp_path: Path) -> None:
        # Probe J. Metadata lands in a dict, so a repeated key was
        # silently resolved in favour of whichever line came last. The
        # exporter never writes a key twice, so a file that does has
        # been edited or damaged, and which value is true cannot be
        # known from here.
        text = (
            "# source: camera\r\n# source: file\r\n"
            + HEADER
            + "\r\n"
            + a_row(1000)
            + "\r\n"
            + a_row(2000)
            + "\r\n"
        )
        with pytest.raises(SessionError, match="twice"):
            load_session(write(tmp_path, text))


class TestTheSourceOfASession:
    """7.0 writes where a session's frames came from, and 7.4 will
    depend on being able to tell a webcam session from a dataset clip.
    A batch of feature CSVs that cannot say which is which would let
    one average across both without noticing."""

    def test_a_clip_session_names_its_file(self, tmp_path: Path) -> None:
        text = (
            "# source: file\r\n"
            "# clip: 06_5.mp4\r\n"
            "# kss_before: not reported\r\n"
            "# kss_after: not reported\r\n"
            + HEADER
            + "\r\n"
            + a_row(1000)
            + "\r\n"
            + a_row(2000)
            + "\r\n"
        )
        session = load_session(write(tmp_path, text))
        assert session.metadata["source"] == "file"
        assert session.metadata["clip"] == "06_5.mp4"

    def test_a_camera_session_claims_no_clip(self, tmp_path: Path) -> None:
        text = (
            "# source: camera\r\n"
            "# clip: none\r\n"
            + HEADER
            + "\r\n"
            + a_row(1000)
            + "\r\n"
            + a_row(2000)
            + "\r\n"
        )
        session = load_session(write(tmp_path, text))
        assert session.metadata["source"] == "camera"
        assert session.metadata["clip"] == "none"

    def test_an_older_export_has_no_source(self, tmp_path: Path) -> None:
        # Sessions exported before 7.0 carry no source rows. They must
        # still load, and must not silently claim to be either kind.
        text = HEADER + "\r\n" + a_row(1000) + "\r\n" + a_row(2000) + "\r\n"
        session = load_session(write(tmp_path, text))
        assert "source" not in session.metadata


class TestTheHonestyRowsNothingRead:
    """Roadmap 10.1f2, ladder D6.

    Three keys were written into every export and read by nothing.
    `app_commit` and `protocol` say which build and which protocol
    produced a file, so without them a cohort table can silently mix
    two instruments; `feature_records_dropped` says how many per-second
    rows fell out of the buffer, so without it a truncated session is
    indistinguishable from a short one.
    """

    def _session(self, tmp_path: Path, header_lines: str) -> object:
        path = tmp_path / "s.csv"
        path.write_text(
            header_lines
            + HEADER
            + "\r\n1,true,60,7,,,,,,,,0,,,false,true,,\r\n",
            encoding="utf-8",
        )
        return load_session(path)

    def test_carries_the_build_and_the_protocol(self, tmp_path: Path) -> None:
        session = self._session(
            tmp_path,
            "# app_commit: abc1234\r\n# protocol: docs/plan.md, 1 January\r\n",
        )
        assert session.app_commit == "abc1234"
        assert session.protocol == "docs/plan.md, 1 January"

    def test_says_unknown_rather_than_guessing_on_an_older_file(
        self, tmp_path: Path
    ) -> None:
        # Every export before 2026-08-28 predates these keys. A file
        # without them is old, not damaged, and the honest answer is
        # None rather than a made-up commit.
        session = self._session(tmp_path, "")
        assert session.app_commit is None
        assert session.protocol is None

    def test_counts_the_rows_that_fell_out_of_the_buffer(
        self, tmp_path: Path
    ) -> None:
        session = self._session(tmp_path, "# feature_records_dropped: 12\r\n")
        assert session.records_dropped == 12

    def test_a_file_with_no_dropped_row_says_zero_not_unknown(
        self, tmp_path: Path
    ) -> None:
        # Zero is a measurement here: the exporter writes this key on
        # every session, so its absence means an older build and its
        # presence with a zero means nothing was lost.
        assert (
            self._session(
                tmp_path, "# feature_records_dropped: 0\r\n"
            ).records_dropped
            == 0
        )
        assert self._session(tmp_path, "").records_dropped is None

    def test_an_unreadable_count_is_refused_rather_than_defaulted(
        self, tmp_path: Path
    ) -> None:
        with pytest.raises(SessionError, match="feature_records_dropped"):
            self._session(tmp_path, "# feature_records_dropped: lots\r\n")


class TestTheCohortsBuild:
    """Roadmap 10.1f2, ladder D6.

    A table that averages across sessions is a table about one
    instrument, and nothing checked that. `app_commit` has been in
    every export since remediation E2 and no tool read it, so a cohort
    spanning a detector change would have been reported as one number
    with no note.
    """

    def test_one_commit_is_named(self) -> None:
        assert cohort_commit_line(["abc1234"]) == (
            "All sessions were recorded by build abc1234."
        )

    def test_a_mixed_cohort_says_so_and_names_the_builds(self) -> None:
        line = cohort_commit_line(["abc1234", "def5678"])
        assert "2 different builds" in line
        assert "abc1234" in line and "def5678" in line
        # The point of the sentence is that the reader stops trusting
        # the average, so it has to say that in words.
        assert "not one instrument" in line

    def test_a_cohort_with_no_stamp_says_which_way_it_is_unknown(self) -> None:
        # Every export before remediation E2 carries no app_commit. That
        # is an older cohort, not a mixed one, and calling it mixed
        # would be as wrong as calling it uniform.
        assert cohort_commit_line([]) == (
            "No session names the build that recorded it, so these "
            "files predate the build stamp and whether they share an "
            "instrument is unknown."
        )

    def test_the_distinct_set_is_sorted_and_ignores_the_unstamped(
        self, tmp_path: Path
    ) -> None:
        def session(commit: str | None) -> object:
            path = tmp_path / f"{commit or 'none'}.csv"
            stamp = f"# app_commit: {commit}\r\n" if commit else ""
            path.write_text(
                stamp + HEADER + "\r\n1,true,60,7,,,,,,,,0,,,false,true,,\r\n",
                encoding="utf-8",
            )
            return load_session(path)

        sessions = [session("def5678"), session("abc1234"), session(None)]
        assert cohort_commits(sessions) == ["abc1234", "def5678"]
