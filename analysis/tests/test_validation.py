"""What the validation round's reader must refuse, and what it must not.

The refusals matter more than the reading. This project's recurring
defect is a step that fails and reports success, so every way this
reader can be handed something untrustworthy is asserted here, and so
is the one case that must NOT be a refusal: a session whose blink log
does not exist because nothing was ever detected.

The plan these tests serve is `docs/validation-plan.md`, written before
any real file existed.
"""

from pathlib import Path

import pytest

from blinklab.loader import COLUMNS
from blinklab.validation import (
    ValidationError,
    find_pairs,
    load_camera_blinks,
    load_pair,
    session_markers_ms,
)

BLINK_HEADER = (
    "startFrame,endFrame,atMs,durationMs,amplitudeMm,"
    "peakClosingVelocityMmPerS,amplitudeOverVelocityMs"
)


def blink_row(at_ms: float, amplitude: str = "4.2") -> str:
    """One live-camera blink row: no frames, because there are none."""
    return f",,{at_ms},120,{amplitude},95,44"


def blink_file(
    tmp_path: Path,
    rows: list[str],
    metadata: list[str] | None = None,
    name: str = "blinks.csv",
) -> Path:
    lines = metadata if metadata is not None else ["# source: camera"]
    path = tmp_path / name
    path.write_text(
        "\r\n".join([*lines, BLINK_HEADER, *rows]) + "\r\n",
        encoding="utf-8",
    )
    return path


def session_row(timestamp: int) -> str:
    cells = [str(timestamp), "true", "60", "7.0"] + [""] * 7
    cells += ["0", "", "", "", "", "", ""]
    return ",".join(cells)


def session_file(
    tmp_path: Path,
    metadata: list[str],
    rows: list[str] | None = None,
    name: str = "session.csv",
) -> Path:
    body = rows if rows is not None else [session_row(1000), session_row(2000)]
    path = tmp_path / name
    path.write_text(
        "\n".join([*metadata, ",".join(COLUMNS), *body]) + "\n",
        encoding="utf-8",
    )
    return path


class TestReadingALiveBlinkLog:
    def test_reads_times_and_durations(self, tmp_path: Path) -> None:
        log = load_camera_blinks(
            blink_file(tmp_path, [blink_row(1000), blink_row(2500)])
        )
        assert [blink.at_ms for blink in log.blinks] == [1000.0, 2500.0]
        assert log.blinks[0].duration_ms == 120.0

    def test_an_unmeasured_amplitude_stays_unmeasured(
        self, tmp_path: Path
    ) -> None:
        # The contract's central rule. A blink whose shape could not be
        # analysed is not a blink of zero amplitude.
        log = load_camera_blinks(
            blink_file(tmp_path, [blink_row(1000, amplitude="")])
        )
        assert log.blinks[0].amplitude_mm is None

    def test_reads_the_exporters_own_truncation_warning(
        self, tmp_path: Path
    ) -> None:
        log = load_camera_blinks(
            blink_file(
                tmp_path,
                [blink_row(1000)],
                metadata=[
                    "# source: camera",
                    "# blinks_detected: 40",
                    "# blinks_recorded: 1",
                ],
            )
        )
        assert log.blinks_lost == 39

    def test_no_warning_means_nothing_lost(self, tmp_path: Path) -> None:
        log = load_camera_blinks(blink_file(tmp_path, [blink_row(1000)]))
        assert log.blinks_lost == 0


class TestWhatTheBlinkLogRefuses:
    def test_a_missing_file(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="no such file"):
            load_camera_blinks(tmp_path / "absent.csv")

    def test_a_clip_by_its_metadata(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="clip run"):
            load_camera_blinks(
                blink_file(
                    tmp_path,
                    [blink_row(1000)],
                    metadata=["# source: file", "# clip: eyeblink8.mp4"],
                )
            )

    def test_a_clip_by_its_frame_numbers(self, tmp_path: Path) -> None:
        # Belt and braces: the metadata line and the frame columns say
        # the same thing by different routes, and a file that disagrees
        # with itself is refused twice rather than believed once.
        with pytest.raises(ValidationError, match="frame numbers"):
            load_camera_blinks(
                blink_file(tmp_path, ["900,912,1000,120,4.2,95,44"])
            )

    def test_columns_that_are_not_the_exporters(self, tmp_path: Path) -> None:
        path = tmp_path / "blinks.csv"
        path.write_text("atMs,durationMs\r\n1000,120\r\n", encoding="utf-8")
        with pytest.raises(ValidationError, match="columns are"):
            load_camera_blinks(path)

    def test_a_short_row(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="3 fields"):
            load_camera_blinks(blink_file(tmp_path, [",,1000"]))

    def test_a_time_that_is_not_a_number(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="could not read"):
            load_camera_blinks(blink_file(tmp_path, [",,soon,120,4.2,95,44"]))

    def test_blinks_out_of_time_order(self, tmp_path: Path) -> None:
        # Every window this round cuts assumes they are in order.
        with pytest.raises(ValidationError, match="time order"):
            load_camera_blinks(
                blink_file(tmp_path, [blink_row(2000), blink_row(1000)])
            )

    def test_an_amplitude_that_is_not_a_number(self, tmp_path: Path) -> None:
        # Probe A. This parse sat outside the try block that guards the
        # time and the duration, so one corrupt cell in one
        # participant's file crashed the whole report with a traceback,
        # taking every other participant's row down with it.
        with pytest.raises(ValidationError, match="could not read"):
            load_camera_blinks(blink_file(tmp_path, [",,1000,120,junk,95,44"]))

    def test_a_time_that_is_infinite(self, tmp_path: Path) -> None:
        # float() is happy with "inf" and "nan", and a NaN time is
        # invisible to every window comparison, so these must be
        # refused by name rather than parsed.
        with pytest.raises(ValidationError, match="finite"):
            load_camera_blinks(blink_file(tmp_path, [",,inf,120,4.2,95,44"]))

    def test_an_amplitude_that_is_nan(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="finite"):
            load_camera_blinks(blink_file(tmp_path, [",,1000,120,nan,95,44"]))

    def test_a_metadata_key_declared_twice(self, tmp_path: Path) -> None:
        # Probe J, on the blinks side. A dict resolves a repeated key
        # in favour of the last line, silently, and which value is true
        # cannot be known from here.
        with pytest.raises(ValidationError, match="twice"):
            load_camera_blinks(
                blink_file(
                    tmp_path,
                    [blink_row(1000)],
                    metadata=["# source: camera", "# source: camera"],
                )
            )

    def test_a_malformed_truncation_declaration(self, tmp_path: Path) -> None:
        # Probe R of the second pass. blinks_lost caught the ValueError
        # and returned 0, so a file that DECLARES it lost rows read as
        # having lost none, and its window count printed as a count
        # rather than a floor. The declaration exists so truncation
        # cannot hide (#172); a declaration that cannot be read must
        # not quietly mean "nothing lost".
        with pytest.raises(ValidationError, match="truncation"):
            load_camera_blinks(
                blink_file(
                    tmp_path,
                    [blink_row(1000)],
                    metadata=[
                        "# source: camera",
                        "# blinks_detected: 40.5",
                        "# blinks_recorded: 1",
                    ],
                )
            )

    def test_a_backwards_truncation_declaration(self, tmp_path: Path) -> None:
        # Probe S. More rows recorded than detected cannot be true, and
        # max(0, ...) silently read it as nothing lost.
        with pytest.raises(ValidationError, match="cannot be true"):
            load_camera_blinks(
                blink_file(
                    tmp_path,
                    [blink_row(1000)],
                    metadata=[
                        "# source: camera",
                        "# blinks_detected: 5",
                        "# blinks_recorded: 10",
                    ],
                )
            )

    def test_half_a_truncation_declaration(self, tmp_path: Path) -> None:
        # The exporter writes both lines or neither. One alone means
        # the file lost a metadata line somewhere, and what the
        # remaining number means cannot be known from here.
        with pytest.raises(ValidationError, match="truncation"):
            load_camera_blinks(
                blink_file(
                    tmp_path,
                    [blink_row(1000)],
                    metadata=[
                        "# source: camera",
                        "# blinks_detected: 5",
                    ],
                )
            )

    def test_a_header_and_nothing_else(self, tmp_path: Path) -> None:
        # Distinct from "no blinks detected", which produces no file at
        # all. The page cannot write this, so it arrived some other
        # way, and accepting it as zero blinks would make a truncated
        # file and a real detection failure identical in the table.
        path = tmp_path / "blinks.csv"
        path.write_text(BLINK_HEADER + "\r\n", encoding="utf-8")
        with pytest.raises(ValidationError, match="lost its rows"):
            load_camera_blinks(path)


class TestMarkers:
    def test_reads_them_in_milliseconds_on_the_records_clock(
        self, tmp_path: Path
    ) -> None:
        pair = load_pair(
            find_pairs_of(
                tmp_path,
                [
                    "# source: camera",
                    "# markers: 2",
                    "# marker_1_seconds: 42.500",
                    "# marker_2_seconds: 61.000",
                ],
            )[0]
        )
        assert session_markers_ms(pair.session) == [42500.0, 61000.0]

    def test_no_markers_is_an_empty_list_not_a_refusal(
        self, tmp_path: Path
    ) -> None:
        # Checks 1 and 2 cannot be computed, and the report says so per
        # row. Refusing here would drop the whole participant.
        pair = load_pair(
            find_pairs_of(tmp_path, ["# source: camera", "# markers: 0"])[0]
        )
        assert session_markers_ms(pair.session) == []

    def test_a_declared_count_that_disagrees_with_the_lines(
        self, tmp_path: Path
    ) -> None:
        pair = load_pair(
            find_pairs_of(
                tmp_path,
                [
                    "# source: camera",
                    "# markers: 3",
                    "# marker_1_seconds: 10.0",
                    "# marker_2_seconds: 20.0",
                ],
            )[0]
        )
        with pytest.raises(ValidationError, match="declares 3 markers"):
            session_markers_ms(pair.session)

    def test_markers_numbered_one_way_and_timed_another(
        self, tmp_path: Path
    ) -> None:
        pair = load_pair(
            find_pairs_of(
                tmp_path,
                [
                    "# source: camera",
                    "# markers: 2",
                    "# marker_1_seconds: 60.0",
                    "# marker_2_seconds: 10.0",
                ],
            )[0]
        )
        with pytest.raises(ValidationError, match="numbered in one order"):
            session_markers_ms(pair.session)

    def test_a_marker_that_is_not_a_number(self, tmp_path: Path) -> None:
        pair = load_pair(
            find_pairs_of(
                tmp_path,
                [
                    "# source: camera",
                    "# markers: 1",
                    "# marker_1_seconds: later",
                ],
            )[0]
        )
        with pytest.raises(ValidationError, match="not a number"):
            session_markers_ms(pair.session)

    def test_a_marker_that_is_nan(self, tmp_path: Path) -> None:
        # Probe K2, the one whose prediction was wrong. float("nan")
        # parses, sorted() carries the same NaN object across so the
        # order check compares it to itself by identity and passes, and
        # then every window comparison against NaN is False: nothing in
        # the window, nothing near either mark, verdict MISSED, exit
        # zero. One unparseable marker manufactured detector-failure
        # evidence silently.
        pair = load_pair(
            find_pairs_of(
                tmp_path,
                [
                    "# source: camera",
                    "# markers: 2",
                    "# marker_1_seconds: 30.0",
                    "# marker_2_seconds: nan",
                ],
            )[0]
        )
        with pytest.raises(ValidationError, match="finite"):
            session_markers_ms(pair.session)

    def test_a_marker_that_is_infinite(self, tmp_path: Path) -> None:
        # Probe K1. An endless window swallows every blink in the file.
        pair = load_pair(
            find_pairs_of(
                tmp_path,
                [
                    "# source: camera",
                    "# markers: 2",
                    "# marker_1_seconds: 30.0",
                    "# marker_2_seconds: inf",
                ],
            )[0]
        )
        with pytest.raises(ValidationError, match="finite"):
            session_markers_ms(pair.session)


def find_pairs_of(tmp_path: Path, metadata: list[str]) -> list:
    """One session file in its own folder, paired."""
    folder = tmp_path / "round"
    folder.mkdir(exist_ok=True)
    session_file(
        folder, metadata, name="blinklab-session-2026-08-16T09-00-00-000.csv"
    )
    return find_pairs(folder)


class TestPairingAFolder:
    def test_pairs_by_the_stamp_in_the_filename(self, tmp_path: Path) -> None:
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        blink_file(
            tmp_path,
            [blink_row(1000)],
            name="blinklab-blinks-2026-08-16T09-00-00-000.csv",
        )
        pairs = find_pairs(tmp_path)
        assert len(pairs) == 1
        assert pairs[0].label == "P1"
        assert pairs[0].blinks_path is not None

    def test_labels_run_in_time_order(self, tmp_path: Path) -> None:
        # The stamp is an ISO time with its colons swapped for dashes,
        # so sorting by name sorts by time.
        for stamp in ("2026-08-17T09-00-00-000", "2026-08-16T09-00-00-000"):
            session_file(
                tmp_path,
                ["# source: camera"],
                name=f"blinklab-session-{stamp}.csv",
            )
        pairs = find_pairs(tmp_path)
        assert [pair.label for pair in pairs] == ["P1", "P2"]
        assert pairs[0].stamp == "2026-08-16T09-00-00-000"

    def test_a_session_with_no_blink_log_is_kept(self, tmp_path: Path) -> None:
        # THE line this module exists for. No blink log means the page
        # detected nothing, which is a RESULT, and it looks exactly
        # like a participant who forgot to press the button. Dropping
        # them would hide the worst outcome the round can produce.
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        pairs = find_pairs(tmp_path)
        assert len(pairs) == 1
        assert pairs[0].blinks_path is None
        assert load_pair(pairs[0]).no_blinks_detected

    def test_a_blink_log_with_no_session_is_refused(
        self, tmp_path: Path
    ) -> None:
        blink_file(
            tmp_path,
            [blink_row(1000)],
            name="blinklab-blinks-2026-08-16T09-00-00-000.csv",
        )
        with pytest.raises(ValidationError, match="no matching session"):
            find_pairs(tmp_path)

    def test_a_renamed_file_is_refused_rather_than_skipped(
        self, tmp_path: Path
    ) -> None:
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        (tmp_path / "sarahs-session.csv").write_text("x", encoding="utf-8")
        with pytest.raises(ValidationError, match="renamed file"):
            find_pairs(tmp_path)

    def test_an_uppercase_extension_is_refused_not_invisible(
        self, tmp_path: Path
    ) -> None:
        # Probe F, the worst finding of the adversarial run. The old
        # glob("*.csv") was case sensitive, so a blinks file renamed to
        # .CSV in transit was not paired, not a stray, not refused. The
        # session paired with nothing, the row said "no log", and a
        # file holding ten detected blinks became a MISSED verdict that
        # criterion 1 counted against the detector. Exit code zero.
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        blink_file(
            tmp_path,
            [blink_row(1000)],
            name="blinklab-blinks-2026-08-16T09-00-00-000.CSV",
        )
        with pytest.raises(ValidationError, match=r"\.CSV"):
            find_pairs(tmp_path)

    def test_a_mail_clients_txt_suffix_is_refused_not_invisible(
        self, tmp_path: Path
    ) -> None:
        # Probe G, same silent MISSED flip through a different rename.
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        blink_file(
            tmp_path,
            [blink_row(1000)],
            name="blinklab-blinks-2026-08-16T09-00-00-000.csv.txt",
        )
        with pytest.raises(ValidationError, match=r"\.csv\.txt"):
            find_pairs(tmp_path)

    def test_a_file_that_is_not_a_csv_at_all_is_refused(
        self, tmp_path: Path
    ) -> None:
        # Probe G. The docstring already promised that nothing in the
        # folder goes unaccounted for; the old glob quietly limited
        # that promise to files ending .csv in exactly that case.
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        (tmp_path / "notes.txt").write_text("ran it at my desk\n")
        with pytest.raises(ValidationError, match="notes.txt"):
            find_pairs(tmp_path)

    def test_a_subdirectory_is_refused(self, tmp_path: Path) -> None:
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        (tmp_path / "extracted").mkdir()
        with pytest.raises(ValidationError, match="extracted"):
            find_pairs(tmp_path)

    def test_the_ds_store_file_alone_is_ignored(self, tmp_path: Path) -> None:
        # The one exception, by name: macOS drops .DS_Store into any
        # folder Finder has opened, and refusing the whole round over
        # it would train people to expect refusals that mean nothing.
        session_file(
            tmp_path,
            ["# source: camera"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        (tmp_path / ".DS_Store").write_bytes(b"\x00\x01")
        assert len(find_pairs(tmp_path)) == 1

    def test_an_empty_folder(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="no session exports"):
            find_pairs(tmp_path)

    def test_a_folder_that_is_not_there(self, tmp_path: Path) -> None:
        with pytest.raises(ValidationError, match="no such folder"):
            find_pairs(tmp_path / "absent")


class TestLoadingAPair:
    def test_loads_both_files(self, tmp_path: Path) -> None:
        session_file(
            tmp_path,
            ["# source: camera", "# markers: 0"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        blink_file(
            tmp_path,
            [blink_row(1500)],
            name="blinklab-blinks-2026-08-16T09-00-00-000.csv",
        )
        pair = load_pair(find_pairs(tmp_path)[0])
        assert pair.blinks is not None
        assert len(pair.blinks.blinks) == 1
        assert not pair.no_blinks_detected

    def test_a_clip_session_is_refused(self, tmp_path: Path) -> None:
        session_file(
            tmp_path,
            ["# source: file", "# clip: eyeblink8.mp4"],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        with pytest.raises(ValidationError, match="clip run"):
            load_pair(find_pairs(tmp_path)[0])

    def test_a_malformed_session_names_the_file(self, tmp_path: Path) -> None:
        # The reason the loader's error is wrapped rather than raised
        # bare: with six of these in a folder, "timestamps are not in
        # order" without a filename says nothing about whose.
        session_file(
            tmp_path,
            ["# source: camera"],
            rows=[session_row(2000), session_row(1000)],
            name="blinklab-session-2026-08-16T09-00-00-000.csv",
        )
        with pytest.raises(ValidationError, match="blinklab-session-.*: "):
            load_pair(find_pairs(tmp_path)[0])
