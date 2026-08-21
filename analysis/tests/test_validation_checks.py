"""One test per verdict, and one per way a row can be wrong.

The rules under test are fixed by `docs/validation-plan.md`. Where a
test asserts a number, that number comes from the plan and not from the
implementation, which is the only arrangement in which a test can
disagree with the code.
"""

from pathlib import Path

import pytest

from blinklab.loader import COLUMNS, load_session
from blinklab.validation import ValidationError, find_pairs, load_pair
from blinklab.validation_checks import (
    AMBIGUOUS,
    COUNTED,
    MISSED,
    OVER_COUNTED,
    baseline_settling,
    count_between_marks,
    long_closures,
    processing_fps_median,
    row_for,
    session_name,
)

BLINK_HEADER = (
    "startFrame,endFrame,atMs,durationMs,amplitudeMm,"
    "peakClosingVelocityMmPerS,amplitudeOverVelocityMs"
)
STAMP = "2026-08-16T09-00-00-000"


def write_blinks(folder: Path, times: list[float]) -> Path:
    rows = [f",,{time},120,4.2,95,44" for time in times]
    path = folder / f"blinklab-blinks-{STAMP}.csv"
    path.write_text(
        "\r\n".join(["# source: camera", BLINK_HEADER, *rows]) + "\r\n",
        encoding="utf-8",
    )
    return path


def a_row(
    timestamp: int,
    baseline: str = "",
    closures: str = "0",
    fps: str = "60",
    face: str = "true",
    aperture: str = "7.0",
) -> str:
    # timestampMs, faceDetected, fps, apertureMm, baselineMm, then the
    # rest empty except longClosureCount.
    cells = [str(timestamp), face, fps, aperture, baseline] + [""] * 6
    cells += [closures, "", "", "", "true"]
    return ",".join(cells)


def write_session(
    folder: Path,
    metadata: list[str],
    rows: list[str] | None = None,
) -> Path:
    body = rows if rows is not None else [a_row(1000), a_row(2000)]
    path = folder / f"blinklab-session-{STAMP}.csv"
    path.write_text(
        "\n".join([*metadata, ",".join(COLUMNS), *body]) + "\n",
        encoding="utf-8",
    )
    return path


def blink_log(tmp_path: Path, times: list[float]):
    from blinklab.validation import load_camera_blinks

    return load_camera_blinks(write_blinks(tmp_path, times))


class TestTheTenMarkedBlinks:
    def test_ten_in_the_window_is_counted(self, tmp_path: Path) -> None:
        times = [10_000 + index * 500 for index in range(10)]
        result = count_between_marks(blink_log(tmp_path, times), [5000, 20000])
        assert result is not None
        assert result.in_window == 10
        assert result.verdict == COUNTED

    def test_nine_that_a_shift_could_reach_is_ambiguous(
        self, tmp_path: Path
    ) -> None:
        # Nine inside, and one 400 ms before mark 1. A mark can sit up
        # to a second early, so that tenth blink may well belong in the
        # window and the table must not call this a miss.
        times = [9600.0] + [10_000 + index * 500 for index in range(9)]
        result = count_between_marks(
            blink_log(tmp_path, times), [10_000, 20000]
        )
        assert result is not None
        assert result.in_window == 9
        assert result.near_start == 1
        assert result.verdict == AMBIGUOUS

    def test_a_count_the_slack_cannot_rescue_is_missed(
        self, tmp_path: Path
    ) -> None:
        # Four blinks, nothing near either mark. No shift of a boundary
        # reaches ten, so this is evidence about the detector.
        times = [12_000.0, 13_000.0, 14_000.0, 15_000.0]
        result = count_between_marks(
            blink_log(tmp_path, times), [10_000, 20000]
        )
        assert result is not None
        assert result.verdict == MISSED
        assert result.highest_possible == 4

    def test_too_many_is_over_counted_not_missed(self, tmp_path: Path) -> None:
        # The correction of 16 August. Fourteen cannot reach ten
        # either, and calling that "missed" would be exactly backwards.
        # Not hypothetical: precision on Eyeblink8 is 83.3 percent.
        times = [11_000 + index * 500 for index in range(14)]
        result = count_between_marks(
            blink_log(tmp_path, times), [10_000, 20000]
        )
        assert result is not None
        assert result.in_window == 14
        assert result.verdict == OVER_COUNTED

    def test_blinks_just_after_the_second_mark_count_as_near(
        self, tmp_path: Path
    ) -> None:
        times = [10_500.0, 20_400.0]
        result = count_between_marks(
            blink_log(tmp_path, times), [10_000, 20000]
        )
        assert result is not None
        assert result.near_end == 1

    def test_a_blink_exactly_at_a_mark_counts_once(
        self, tmp_path: Path
    ) -> None:
        # Probe Q of the second pass, the control that behaved. The
        # boundary is inclusive, so a blink at the mark's own
        # millisecond is in the window, is NOT also near-start, and is
        # an edge blink the slack could move out.
        times = [10_000.0, 15_000.0]
        result = count_between_marks(
            blink_log(tmp_path, times), [10_000, 20_000]
        )
        assert result is not None
        assert result.in_window == 2
        assert result.near_start == 0
        assert result.edge_of_window == 1

    def test_fewer_than_two_marks_is_not_a_zero(self, tmp_path: Path) -> None:
        # A zero would be a claim about the instrument. This is a fact
        # about the file, and the two must not print the same.
        assert (
            count_between_marks(blink_log(tmp_path, [1000.0]), [5000]) is None
        )

    def test_the_window_carries_its_own_width(self, tmp_path: Path) -> None:
        # Queued rule 3 of the round write-up, the half the tool can
        # take now: the width travels with the counts, so a reader can
        # see what the counts were counted over.
        result = count_between_marks(
            blink_log(tmp_path, [12_000.0]), [5000, 20_000]
        )
        assert result is not None
        assert result.width_s == pytest.approx(15.0)

    def test_a_zero_width_window_is_zero_not_hidden(
        self, tmp_path: Path
    ) -> None:
        # Probe P of the second pass. Two marks stamped inside the same
        # one-second record carry the same time, so the window between
        # them has no width. The verdict stays what the plan computes,
        # because what such a window MEANS is the next plan's queued
        # rule; the width is simply no longer invisible.
        result = count_between_marks(
            blink_log(tmp_path, [12_000.0]), [10_000, 10_000]
        )
        assert result is not None
        assert result.width_s == 0.0
        assert result.verdict == MISSED


class TestTheBaseline:
    def test_reports_when_it_became_ready(self, tmp_path: Path) -> None:
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000),
                a_row(31_000, baseline="7.4"),
                a_row(32_000, baseline="7.4"),
            ],
        )
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.ready_after_s == pytest.approx(30.0)
        assert settling.drift_pct == pytest.approx(0.0)

    def test_a_rising_baseline_shows_as_drift(self, tmp_path: Path) -> None:
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000, baseline="7.0"),
                a_row(2000, baseline="7.7"),
            ],
        )
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.drift_pct == pytest.approx(10.0)

    def test_a_baseline_that_never_arrives_is_none_not_zero(
        self, tmp_path: Path
    ) -> None:
        # The worst result this check can carry: every blink in that
        # session was judged against a ruler that does not exist. A
        # zero would read as a ruler of zero millimetres.
        write_session(tmp_path, ["# source: camera"])
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.ready_after_s is None
        assert settling.drift_pct is None

    def test_a_drift_past_the_ceiling_is_flagged(self, tmp_path: Path) -> None:
        # 15 percent, set from the owner's own three sessions which
        # measured 0.0, 0.0 and 5.0, before any volunteer file existed.
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000, baseline="7.0"),
                a_row(2000, baseline="8.2"),
            ],
        )
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.drift_pct == pytest.approx(17.14, abs=0.01)
        assert settling.drifted

    def test_a_baseline_born_too_long_is_flagged(self, tmp_path: Path) -> None:
        # The plan's second correction, found by real data. The MacBook
        # Air learned a baseline of 9.80 mm from a face whose median
        # aperture was 6.93, a ratio of 1.41, which put the blink line
        # at 71 percent of resting. Readiness and drift BOTH passed on
        # that session: a baseline born wrong does not move.
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000, baseline="9.8", aperture="6.93"),
                a_row(2000, baseline="9.8", aperture="6.93"),
            ],
        )
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.drift_pct == pytest.approx(0.0)
        assert not settling.drifted
        assert settling.over_resting == pytest.approx(1.41, abs=0.01)
        assert settling.implausible

    def test_a_baseline_a_little_above_resting_is_fine(
        self, tmp_path: Path
    ) -> None:
        # A p90 sits above the median by design, so the check must not
        # fire on a healthy session. The iPhone read 1.12, the Sony
        # 1.15.
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000, baseline="7.69", aperture="6.88"),
                a_row(2000, baseline="7.69", aperture="6.88"),
            ],
        )
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.over_resting == pytest.approx(1.12, abs=0.01)
        assert not settling.implausible

    def test_the_median_is_not_filtered_by_the_blink_line(
        self, tmp_path: Path
    ) -> None:
        # A definition-pinning test, and the session is deliberately
        # degenerate because that is the only shape in which the two
        # candidate definitions disagree.
        #
        # Three of these five rows sit below the blink line of 4.0 mm.
        # Over the whole session the median aperture is 2.0 and the
        # ratio is 4.00. Filter by the blink line first and the median
        # becomes 7.0 and the ratio 1.14, which passes.
        #
        # The filtered version is the tempting one and it is wrong: it
        # uses the baseline to choose the frames that judge the
        # baseline, so a baseline can excuse itself by declaring more
        # frames to be blinks. Without this test both definitions pass
        # every other assertion in the file.
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000, baseline="8.0", aperture="7.0"),
                a_row(2000, baseline="8.0", aperture="7.0"),
                a_row(3000, baseline="8.0", aperture="2.0"),
                a_row(4000, baseline="8.0", aperture="2.0"),
                a_row(5000, baseline="8.0", aperture="2.0"),
            ],
        )
        settling = baseline_settling(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        )
        assert settling.resting_median_mm == pytest.approx(2.0)
        assert settling.over_resting == pytest.approx(4.0)


class TestTheClosure:
    def test_a_closure_after_the_second_mark_fires(
        self, tmp_path: Path
    ) -> None:
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(10_000, closures="0"),
                a_row(20_000, closures="0"),
                a_row(30_000, closures="1"),
            ],
        )
        counts = long_closures(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame,
            [10_000.0, 20_000.0],
        )
        assert counts.at_mark == 0
        assert counts.at_end == 1
        assert counts.fired is True

    def test_no_closure_at_all(self, tmp_path: Path) -> None:
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[a_row(10_000), a_row(20_000), a_row(30_000)],
        )
        counts = long_closures(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame,
            [10_000.0, 20_000.0],
        )
        assert counts.fired is False

    def test_two_closures_are_visible_as_two(self, tmp_path: Path) -> None:
        # Reported as numbers rather than a boolean, because two
        # closures mean something different from one.
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(10_000, closures="0"),
                a_row(20_000, closures="0"),
                a_row(30_000, closures="2"),
            ],
        )
        counts = long_closures(
            load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame,
            [10_000.0, 20_000.0],
        )
        assert (counts.at_mark, counts.at_end) == (0, 2)


class TestTheRow:
    def full_session(self, tmp_path: Path, **overrides: str) -> None:
        metadata = {
            "source": "camera",
            "camera": "FaceTime HD Camera",
            "camera_declared_fps": "30",
            "face_detected_fraction": "0.987",
            "measurement_frame": "1920x1080",
            "median_iris_width_px": "22.4",
            "visibility_changes": "0",
            "records": "3",
            "observed_duration_seconds": "120.000",
            "markers": "2",
            "marker_1_seconds": "30.000",
            "marker_2_seconds": "45.000",
        }
        metadata.update(overrides)
        write_session(
            tmp_path,
            [f"# {key}: {value}" for key, value in metadata.items()],
            rows=[
                a_row(1000),
                a_row(31_000, baseline="7.0"),
                a_row(46_000, baseline="7.0", closures="1"),
            ],
        )

    def test_carries_every_condition_column(self, tmp_path: Path) -> None:
        self.full_session(tmp_path)
        write_blinks(tmp_path, [30_500 + index * 500 for index in range(10)])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.verdict == COUNTED
        assert row.camera == "FaceTime HD Camera"
        assert row.median_iris_width_px == pytest.approx(22.4)
        assert row.measurement_frame == "1920x1080"
        assert row.face_detected_fraction == pytest.approx(0.987)
        assert row.processing_fps_median == pytest.approx(60.0)

    def test_a_session_with_no_blink_log_is_a_miss(
        self, tmp_path: Path
    ) -> None:
        # The single most important assertion in the round. The page
        # writes no blink file at all when it detected nothing, so this
        # is a total instrument failure and it must not read as a gap.
        self.full_session(tmp_path)
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.no_blinks_detected
        assert row.verdict == MISSED

    def test_an_unknown_metadata_value_is_none_not_zero(
        self, tmp_path: Path
    ) -> None:
        # The exporter writes "unknown" rather than dropping the row,
        # which is right for a person reading the file and wrong to
        # hand to float().
        self.full_session(tmp_path, camera_declared_fps="unknown")
        write_blinks(tmp_path, [31_000.0])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.camera_declared_fps is None
        assert not row.gate_would_refuse

    def test_a_metadata_number_that_is_nan_is_none_not_nan(
        self, tmp_path: Path
    ) -> None:
        # Probe L. float("nan") does not raise, so NaN flowed into the
        # row, every comparison against it was False, no floor fired,
        # and the published table printed the word nan. NaN is not a
        # measurement, so it reads as unknown, the same as "unknown".
        self.full_session(
            tmp_path,
            face_detected_fraction="nan",
            camera_declared_fps="inf",
        )
        write_blinks(tmp_path, [31_000.0])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.face_detected_fraction is None
        assert row.camera_declared_fps is None
        assert not row.face_below_floor
        assert not row.gate_would_refuse

    def test_a_slow_camera_behind_a_fast_display_is_flagged(
        self, tmp_path: Path
    ) -> None:
        # Remediation D1's held question, answered from real files: the
        # gate reads the processing rate, so a 20 fps camera on a 60 Hz
        # display keeps it open on a session that should be refused.
        self.full_session(tmp_path, camera_declared_fps="20")
        write_blinks(tmp_path, [31_000.0])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.gate_would_refuse

    def test_a_face_share_under_the_floor_is_flagged(
        self, tmp_path: Path
    ) -> None:
        self.full_session(tmp_path, face_detected_fraction="0.500")
        write_blinks(tmp_path, [31_000.0])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.face_below_floor

    def test_a_truncated_blink_log_is_carried_into_the_row(
        self, tmp_path: Path
    ) -> None:
        self.full_session(tmp_path)
        path = tmp_path / f"blinklab-blinks-{STAMP}.csv"
        path.write_text(
            "\r\n".join(
                [
                    "# source: camera",
                    "# blinks_detected: 40",
                    "# blinks_recorded: 1",
                    BLINK_HEADER,
                    ",,31000,120,4.2,95,44",
                ]
            )
            + "\r\n",
            encoding="utf-8",
        )
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.blinks_lost == 39

    def test_no_markers_leaves_the_window_unmarkable(
        self, tmp_path: Path
    ) -> None:
        self.full_session(tmp_path, markers="0")
        # The marker lines have to go too, or the declared count and
        # the lines disagree and the reader refuses the file.
        text = (tmp_path / f"blinklab-session-{STAMP}.csv").read_text()
        (tmp_path / f"blinklab-session-{STAMP}.csv").write_text(
            "\n".join(
                line
                for line in text.splitlines()
                if not line.startswith("# marker_")
            )
            + "\n",
            encoding="utf-8",
        )
        write_blinks(tmp_path, [31_000.0])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.window is None
        assert row.verdict == "not markable"


class TestProcessingRate:
    def test_the_median_of_the_fps_column(self, tmp_path: Path) -> None:
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[
                a_row(1000, fps="30"),
                a_row(2000, fps="60"),
                a_row(3000, fps="90"),
            ],
        )
        frame = load_session(tmp_path / f"blinklab-session-{STAMP}.csv").frame
        assert processing_fps_median(frame) == pytest.approx(60.0)


class TestTheWholeReport:
    def test_prints_a_table_and_answers_the_three_criteria(
        self, tmp_path: Path
    ) -> None:
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [30_500 + index * 500 for index in range(10)])
        lines, refused = report(tmp_path)
        text = "\n".join(lines)
        assert refused == 0
        assert "P1" in text
        assert "FaceTime HD Camera" in text
        assert "1. The detector does not generalise" in text
        assert "not met" in text

    def test_a_refused_participant_gets_a_line_not_a_silence(
        self, tmp_path: Path
    ) -> None:
        # The rule the whole tool turns on. A person missing from the
        # table is a person nobody looks for, so an unreadable file
        # takes a line of its own naming who and why, and the exit code
        # is non-zero so a script cannot mistake it for a clean run.
        from tools.validation_report import report

        write_session(
            tmp_path,
            ["# source: camera", "# markers: 3", "# marker_1_seconds: 1.0"],
        )
        lines, refused = report(tmp_path)
        text = "\n".join(lines)
        assert refused == 1
        assert "REFUSED" in text
        assert "declares 3 markers" in text

    def test_one_participant_prints_singular(self, tmp_path: Path) -> None:
        # Probe U of the second pass: the header printed
        # "1 participants".
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [30_500 + index * 500 for index in range(10)])
        text = "\n".join(report(tmp_path)[0])
        assert "1 participant in" in text
        assert "1 participants" not in text

    def test_a_refusal_line_names_the_file_once(self, tmp_path: Path) -> None:
        # Probe W of the second pass. load_pair wraps the loader's
        # error with the filename, and the report prefixed the same
        # filename again, so session-level refusals printed it twice.
        # The wrapping stays (other callers rely on it); the report
        # just stops repeating it.
        from tools.validation_report import report

        name = f"blinklab-session-{STAMP}.csv"
        write_session(
            tmp_path,
            ["# source: camera"],
            rows=[a_row(2000), a_row(1000)],
        )
        text = "\n".join(report(tmp_path)[0])
        assert f"{name}: {name}" not in text
        assert name in text

    def test_zero_readable_sessions_evaluate_no_criterion(
        self, tmp_path: Path
    ) -> None:
        # Probe M. With nothing read, the criteria section still
        # printed, each criterion concluding "not met" from zero rows
        # of evidence. A reader who trusts the bottom of the page over
        # the middle would read a round that could not read anybody as
        # a round that met its criteria.
        from tools.validation_report import report

        write_session(
            tmp_path,
            ["# source: camera", "# markers: 3", "# marker_1_seconds: 1.0"],
        )
        lines, refused = report(tmp_path)
        text = "\n".join(lines)
        assert refused == 1
        assert "NOT EVALUATED" in text
        assert "not met" not in text

    def test_the_table_prints_the_window_width(self, tmp_path: Path) -> None:
        # Queued rule 3's tool half. Without this column a zero-width
        # window and a fifteen-second one print the same row.
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [30_500 + index * 500 for index in range(10)])
        text = "\n".join(report(tmp_path)[0])
        assert "window (s)" in text
        assert "15.0" in text

    def test_a_window_narrower_than_the_slack_is_named(
        self, tmp_path: Path
    ) -> None:
        # Probe P made real: both marks in the same second. A mark can
        # sit up to a second from its press, so a window narrower than
        # that slack cannot separate its own count from the marker
        # artefact, and the table must say so rather than leave it to
        # a reader comparing two columns. The verdict still prints as
        # computed; deciding what such a window means is queued for the
        # next round's plan.
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path, marker_2_seconds="30.000")
        write_blinks(tmp_path, [30_500 + index * 500 for index in range(10)])
        text = "\n".join(report(tmp_path)[0])
        assert "NARROWER THAN THE MARKER SLACK" in text
        assert "P1 (0.0 s)" in text
        assert MISSED in text

    def test_a_normal_window_carries_no_narrowness_warning(
        self, tmp_path: Path
    ) -> None:
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [30_500 + index * 500 for index in range(10)])
        text = "\n".join(report(tmp_path)[0])
        assert "NARROWER THAN THE MARKER SLACK" not in text

    def test_an_unreadable_folder_stops_the_whole_run(
        self, tmp_path: Path
    ) -> None:
        # Folder-level, so it raises rather than printing a row:
        # reporting on five people while a sixth's file sits unread in
        # the folder is not acceptable.
        from tools.validation_report import report

        write_blinks(tmp_path, [1000.0])
        with pytest.raises(ValidationError, match="no matching session"):
            report(tmp_path)


class TestOnlySoundSessionsVote:
    """The plan's third correction, 18 August, found by the dry run.

    A session whose ruler is wrong is not evidence about the detector in
    either direction. P3 of the dry run counted 10 of 10 with a baseline
    1.41 times its own median aperture, which is a pass earned by a
    loose threshold rather than by working.
    """

    def loose_session(self, folder: Path, stamp: str, blinks: int) -> None:
        """A session whose baseline is too long to be "open"."""
        meta = {
            "source": "camera",
            "camera": "Loose",
            "face_detected_fraction": "1.000",
            "markers": "2",
            "marker_1_seconds": "30.000",
            "marker_2_seconds": "45.000",
        }
        rows = [
            a_row(1000, aperture="6.93"),
            a_row(31_000, baseline="9.80", aperture="6.93"),
            a_row(46_000, baseline="9.80", aperture="6.93", closures="1"),
        ]
        path = folder / f"blinklab-session-{stamp}.csv"
        path.write_text(
            "\n".join(
                [f"# {k}: {v}" for k, v in meta.items()]
                + [",".join(COLUMNS)]
                + rows
            )
            + "\n",
            encoding="utf-8",
        )
        times = [30_500 + i * 1000 for i in range(blinks)]
        (folder / f"blinklab-blinks-{stamp}.csv").write_text(
            "\r\n".join(
                ["# source: camera", BLINK_HEADER]
                + [f",,{t},120,4.2,95,44" for t in times]
            )
            + "\r\n",
            encoding="utf-8",
        )

    def test_a_loose_baseline_makes_a_row_unsound(
        self, tmp_path: Path
    ) -> None:
        self.loose_session(tmp_path, "2026-08-18T09-00-00-000", 10)
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.baseline.over_resting == pytest.approx(1.41, abs=0.01)
        assert not row.baseline_sound
        assert row.unsound_because == "baseline is too long to be open"
        # The verdict is still computed and still reported.
        assert row.verdict == COUNTED

    def test_an_unsound_session_does_not_vote_but_is_named(
        self, tmp_path: Path
    ) -> None:
        from tools.validation_report import report

        # One sound session that missed, one unsound session that
        # "passed". Criterion 1 must count the first and not the second,
        # and must say out loud that the second was excluded.
        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [31_000.0])
        self.loose_session(tmp_path, "2026-08-18T10-00-00-000", 10)
        text = "\n".join(report(tmp_path)[0])
        assert "1 missed" in text
        assert "among the 1 sound sessions" in text
        assert (
            "Excluded as unsound: P2 (baseline is too long to be open)" in text
        )

    def test_more_than_half_unsound_stops_the_criterion_entirely(
        self, tmp_path: Path
    ) -> None:
        # The guard on the exclusion, from the plan: otherwise excluding
        # rows becomes a way to explain away a bad result. Two of three
        # unsound is more than half.
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [31_000.0])
        self.loose_session(tmp_path, "2026-08-18T10-00-00-000", 10)
        self.loose_session(tmp_path, "2026-08-18T11-00-00-000", 3)
        text = "\n".join(report(tmp_path)[0])
        assert "NOT EVALUATED" in text
        assert "2 of 3 sessions have no working baseline" in text
        assert "worse finding" in text

    def test_an_unsound_session_that_MISSES_does_not_vote_either(
        self, tmp_path: Path
    ) -> None:
        # The dangerous direction, and the one the first draft of these
        # tests could not see. A broken ruler can produce a false MISS
        # just as easily as a false pass, and that miss would be counted
        # as evidence that the detector fails when what failed is the
        # ruler. One sound session missed, one unsound session missed;
        # only the first may vote.
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [31_000.0])
        self.loose_session(tmp_path, "2026-08-18T10-00-00-000", 2)
        rows = [row_for(load_pair(p)) for p in find_pairs(tmp_path)]
        assert [r.verdict for r in rows] == [MISSED, MISSED]
        assert [r.baseline_sound for r in rows] == [True, False]
        text = "\n".join(report(tmp_path)[0])
        assert "1 missed (P1)" in text
        assert "2 missed" not in text


class TestARowCarriesItsOwnName:
    """Labels are positional. A published table must not depend on that.

    The dry run's MacBook re-test was P4 on 17 August and became P5 the
    moment a sixth session arrived, which silently falsified the prose
    in `docs/validation-dry-run.txt` around a table it had generated.
    """

    def test_a_session_name_is_read_from_the_filename(self) -> None:
        assert session_name("iphone17promax-2026-08-19T11-54-11-743") == (
            "iphone17promax"
        )
        assert session_name("participant1-2026-08-19T10-38-50-247") == (
            "participant1"
        )

    def test_a_stamp_with_no_name_keeps_its_stamp(self) -> None:
        # The dry run's first files were dated only. Returning an empty
        # string there would put a blank column in a published table.
        assert session_name("2026-08-16T09-00-00-000") == (
            "2026-08-16T09-00-00-000"
        )

    def test_a_stamp_from_another_year_still_yields_its_name(self) -> None:
        # Probe O. The split was on the literal string "-2026", so a
        # file from January 2027 would print its whole stamp in the
        # name column of a published table.
        assert session_name("participant5-2027-01-05T09-00-00-000") == (
            "participant5"
        )

    def test_the_name_survives_a_label_shifting_under_it(
        self, tmp_path: Path
    ) -> None:
        # Add a session that sorts FIRST and the later one's label moves
        # from P1 to P2. Its name must not move with it.
        TestTheRow().full_session(tmp_path)
        write_blinks(tmp_path, [31_000.0])
        alone = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert alone.label == "P1"

        TestOnlySoundSessionsVote().loose_session(
            tmp_path, "2026-08-01T09-00-00-000", 10
        )
        rows = [row_for(load_pair(p)) for p in find_pairs(tmp_path)]
        moved = next(r for r in rows if r.session == alone.session)
        assert moved.label == "P2"
        assert moved.session == alone.session


class TestTheTableShowsHowManyMarks:
    def test_an_extra_mark_is_visible_without_opening_the_file(
        self, tmp_path: Path
    ) -> None:
        # The protocol asks for two. Participants 2 and 3 of the round
        # pressed three and four, and the published table said nothing
        # about it. The window still uses the first two marks; this only
        # makes the deviation visible.
        from tools.validation_report import report

        TestTheRow().full_session(tmp_path, markers="3")
        text = (tmp_path / f"blinklab-session-{STAMP}.csv").read_text()
        (tmp_path / f"blinklab-session-{STAMP}.csv").write_text(
            text.replace(
                "# marker_2_seconds: 45.000",
                "# marker_2_seconds: 45.000\n# marker_3_seconds: 60.000",
            ),
            encoding="utf-8",
        )
        write_blinks(tmp_path, [31_000.0])
        row = row_for(load_pair(find_pairs(tmp_path)[0]))
        assert row.markers_found == 3
        assert "marks" in "\n".join(report(tmp_path)[0])
