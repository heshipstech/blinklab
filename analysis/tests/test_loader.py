"""What the loader must refuse, and why each refusal earns its place.

A loader that half succeeds is worse than one that fails: the plot
still draws, the statistic still prints, and nobody re-derives either
by hand. So every malformed shape here gets a named error.
"""

from pathlib import Path

import pandas as pd
import pytest

from blinklab.loader import COLUMNS, SessionError, load_session

FIXTURE = Path(__file__).parent / "fixtures" / "session-fixture.csv"
HEADER = ",".join(COLUMNS)


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "session.csv"
    path.write_text(text, encoding="utf-8")
    return path


def a_row(timestamp: int = 1000) -> str:
    """One valid row: a face, an aperture, and nothing else measured."""
    cells = [str(timestamp), "true", "60", "7.0"] + [""] * 7
    cells += ["0", "", "", "", ""]
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
