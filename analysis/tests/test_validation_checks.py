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

    def test_fewer_than_two_marks_is_not_a_zero(self, tmp_path: Path) -> None:
        # A zero would be a claim about the instrument. This is a fact
        # about the file, and the two must not print the same.
        assert (
            count_between_marks(blink_log(tmp_path, [1000.0]), [5000]) is None
        )


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
