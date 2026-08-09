"""Tests for reading DROZY sessions into feature rows.

No DROZY video or frame is involved here, and no real subject's data is
committed. Every fixture is written by the test itself.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from blinklab.drozy import (
    FEATURE_NAMES,
    MIN_USABLE_FPS,
    DrozyError,
    load_all,
    load_kss,
    load_session_features,
)

SECONDS_HEADER = (
    "timestampMs,faceDetected,fps,apertureMm,baselineMm,shutBaselineMm,"
    "blinkRatePerMin,lastBlinkDurationMs,lastBlinkAmplitudeMm,"
    "lastBlinkPeakVelocityMmPerS,perclos,longClosureCount,fixationCount,"
    "fixationMedianMs,fixating,onScreen"
)
BLINKS_HEADER = (
    "startFrame,endFrame,atMs,durationMs,amplitudeMm,"
    "peakClosingVelocityMmPerS,amplitudeOverVelocityMs"
)


def write_seconds(path: Path, rows: list[str], fps: str = "30") -> None:
    body = "\n".join(
        f"{i * 1000},true,{fps},{row}" for i, row in enumerate(rows)
    )
    path.write_text(
        "# source: file\n# measurement_mode: stepped\n"
        + SECONDS_HEADER
        + "\n"
        + body
        + "\n",
        encoding="utf-8",
    )


class TestLoadKss:
    def test_reads_the_grid(self, tmp_path: Path) -> None:
        p = tmp_path / "KSS.txt"
        p.write_text("3 6 7\n2 3 4\n", encoding="utf-8")
        assert load_kss(p) == {
            (1, 1): 3,
            (1, 2): 6,
            (1, 3): 7,
            (2, 1): 2,
            (2, 2): 3,
            (2, 3): 4,
        }

    def test_zero_means_the_session_never_happened(
        self, tmp_path: Path
    ) -> None:
        # Not a rating of zero. The scale starts at one, so a zero left in
        # the result could be averaged as if it were the most alert
        # reading possible.
        p = tmp_path / "KSS.txt"
        p.write_text("0 4 9\n", encoding="utf-8")
        assert (1, 1) not in load_kss(p)
        assert load_kss(p)[(1, 2)] == 4

    def test_refuses_a_rating_off_the_scale(self, tmp_path: Path) -> None:
        p = tmp_path / "KSS.txt"
        p.write_text("3 6 12\n", encoding="utf-8")
        with pytest.raises(DrozyError, match="1 to 9"):
            load_kss(p)

    def test_refuses_a_short_row(self, tmp_path: Path) -> None:
        p = tmp_path / "KSS.txt"
        p.write_text("3 6\n", encoding="utf-8")
        with pytest.raises(DrozyError, match="expected 3"):
            load_kss(p)

    def test_refuses_a_file_with_no_ratings(self, tmp_path: Path) -> None:
        p = tmp_path / "KSS.txt"
        p.write_text("0 0 0\n", encoding="utf-8")
        with pytest.raises(DrozyError, match="no ratings"):
            load_kss(p)


class TestSessionFeatures:
    def test_reads_a_session_with_blinks(self, tmp_path: Path) -> None:
        seconds = tmp_path / "1-1.seconds.csv"
        write_seconds(seconds, [",,,,,,,0.05,1,,,," for _ in range(60)])
        blinks = tmp_path / "1-1.blinks.csv"
        blinks.write_text(
            BLINKS_HEADER
            + "\n1,4,100,120,5.0,100,50\n5,8,200,140,6.0,120,50\n",
            encoding="utf-8",
        )
        f = load_session_features(seconds, blinks, 1, 1, 3)
        assert f.subject == 1 and f.session == 1 and f.kss == 3
        assert f.blink_duration_ms == pytest.approx(130.0)
        assert f.blink_amplitude_mm == pytest.approx(5.5)
        # Two blinks in a 60 second window is 2 a minute.
        assert f.blink_rate_per_min == pytest.approx(2.0)
        assert f.perclos == pytest.approx(0.05)
        assert f.usable

    def test_a_session_with_no_blink_file_is_not_zero(
        self, tmp_path: Path
    ) -> None:
        # No blink log means no blink was detected. The rate is genuinely
        # zero, but the SHAPE of a blink that never happened is not zero
        # millimetres, it is unmeasured, and recording 0 would be a claim
        # about somebody's eyelid.
        seconds = tmp_path / "2-2.seconds.csv"
        write_seconds(seconds, [",,,,,,,0.02,0,,,," for _ in range(60)])
        f = load_session_features(seconds, None, 2, 2, 7)
        assert f.blink_rate_per_min == 0.0
        assert f.blink_duration_ms is None
        assert f.blink_amplitude_mm is None
        assert f.closing_velocity_mm_s is None

    def test_a_low_frame_rate_session_is_flagged_not_dropped(
        self, tmp_path: Path
    ) -> None:
        # 16 of DROZY's 36 recordings are 15 fps and blinklab refuses to
        # measure blinks below 25. The loader keeps them and marks them,
        # because deciding what to exclude belongs to the analysis where
        # the rule is stated once and visibly. Issue #192.
        seconds = tmp_path / "3-2.seconds.csv"
        write_seconds(seconds, [",,,,,,,,,,," for _ in range(60)], fps="15")
        f = load_session_features(seconds, None, 3, 2, 8)
        assert f.measured_fps == 15
        assert not f.usable
        assert MIN_USABLE_FPS == 25

    def test_blank_cells_are_skipped_rather_than_read_as_zero(
        self, tmp_path: Path
    ) -> None:
        seconds = tmp_path / "4-1.seconds.csv"
        write_seconds(
            seconds,
            [",,,,,,,0.10,0,,,,", ",,,,,,,,0,,,,", ",,,,,,,0.20,0,,,,"],
        )
        f = load_session_features(seconds, None, 4, 1, 2)
        # Mean of 0.10 and 0.20, not of 0.10, 0 and 0.20.
        assert f.perclos == pytest.approx(0.15)

    def test_refuses_a_file_with_no_rows(self, tmp_path: Path) -> None:
        seconds = tmp_path / "5-1.seconds.csv"
        seconds.write_text("# only comments\n", encoding="utf-8")
        with pytest.raises(DrozyError):
            load_session_features(seconds, None, 5, 1, 3)


class TestLoadAll:
    def test_loads_a_directory(self, tmp_path: Path) -> None:
        (tmp_path / "KSS.txt").write_text("3 6 7\n", encoding="utf-8")
        write_seconds(tmp_path / "1-1.seconds.csv", [",,,,,,,0.05,0,,,,"] * 10)
        write_seconds(tmp_path / "1-2.seconds.csv", [",,,,,,,0.06,0,,,,"] * 10)
        out = load_all(tmp_path, tmp_path / "KSS.txt")
        assert [(s.subject, s.session, s.kss) for s in out] == [
            (1, 1, 3),
            (1, 2, 6),
        ]

    def test_refuses_measurements_with_no_rating(self, tmp_path: Path) -> None:
        # A session the rating file says never happened, but which has
        # measurements, means the wrong KSS.txt was supplied or the wrong
        # folder was measured. Guessing here would silently analyse a
        # mismatched pair.
        (tmp_path / "KSS.txt").write_text("0 4 9\n", encoding="utf-8")
        write_seconds(tmp_path / "1-1.seconds.csv", [",,,,,,,0.05,0,,,,"] * 10)
        with pytest.raises(DrozyError, match="no KSS rating"):
            load_all(tmp_path, tmp_path / "KSS.txt")

    def test_refuses_a_badly_named_file(self, tmp_path: Path) -> None:
        (tmp_path / "KSS.txt").write_text("3 6 7\n", encoding="utf-8")
        write_seconds(
            tmp_path / "subject_one.seconds.csv", [",,,,,,,,,,,"] * 5
        )
        with pytest.raises(DrozyError, match="subject.*session"):
            load_all(tmp_path, tmp_path / "KSS.txt")

    def test_refuses_an_empty_directory(self, tmp_path: Path) -> None:
        (tmp_path / "KSS.txt").write_text("3 6 7\n", encoding="utf-8")
        with pytest.raises(DrozyError, match="no \\*.seconds.csv"):
            load_all(tmp_path, tmp_path / "KSS.txt")


def test_the_seven_features_match_the_pre_registered_plan() -> None:
    # docs/drozy-analysis-plan.md names seven and was committed before any
    # result existed. If this list ever grows, the analysis is testing
    # something other than what was pre-registered, and that has to be a
    # deliberate visible change rather than a quiet one.
    assert len(FEATURE_NAMES) == 7
    assert FEATURE_NAMES == (
        "blink_rate_per_min",
        "blink_duration_ms",
        "blink_amplitude_mm",
        "closing_velocity_mm_s",
        "amplitude_over_velocity_ms",
        "perclos",
        "long_closures",
    )
