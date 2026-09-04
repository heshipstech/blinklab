"""The alertness-score comparison, on SYNTHETIC data only.

No frame or feature of the real UTA-RLDD dataset is used. The heuristic port
is pinned to src/core/score.ts's documented ramp outputs; the AUC is pinned to
hand-checkable cases; and the head-to-head is pinned on corpora whose answer is
known -- one where a feature the heuristic ignores separates the labels (the
learned model must win) and one where PERCLOS separates them (the heuristic
already wins, and the model cannot beat it)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from blinklab.alertness import (
    AlertnessError,
    _ramp_points,
    _row_score,
    auc,
    compare,
    heuristic_video_score,
    load_scored_corpus,
)

COLUMNS = [
    "timestampMs",
    "faceDetected",
    "fps",
    "apertureMm",
    "baselineMm",
    "shutBaselineMm",
    "blinkRatePerMin",
    "lastBlinkDurationMs",
    "lastBlinkAmplitudeMm",
    "lastBlinkPeakVelocityMmPerS",
    "perclos",
    "longClosureCount",
    "fixationCount",
    "fixationMedianMs",
    "fixating",
    "onScreen",
    "baselineOverResting",
]


def _write_video(
    directory: Path,
    subject: str,
    label: str,
    *,
    blink_rate: float | None = None,
    blink_duration: float | None = None,
    amplitude: float | None = None,
    velocity: float | None = None,
    perclos: float = 0.05,
    fps: float = 30.0,
    last_second: int = 400,
) -> Path:
    """A per-second CSV whose in-window (60-360) columns carry the given
    signatures, blank outside the window as the real exports are. Frame rate
    clears the 25 fps floor and the recording reaches the window end."""
    lines = ["# measurement_mode: stepped", ",".join(COLUMNS)]
    for second in range(last_second + 1):
        row: dict[str, object] = {
            "timestampMs": second * 1000,
            "faceDetected": "true",
            "fps": fps,
            "longClosureCount": 0,
        }
        if 60 <= second < 360:
            row["perclos"] = perclos
            if blink_rate is not None:
                row["blinkRatePerMin"] = blink_rate
            if blink_duration is not None:
                row["lastBlinkDurationMs"] = blink_duration
            if amplitude is not None:
                row["lastBlinkAmplitudeMm"] = amplitude
            if velocity is not None:
                row["lastBlinkPeakVelocityMmPerS"] = velocity
        lines.append(",".join(str(row.get(c, "")) for c in COLUMNS))
    path = directory / f"{subject}_{label}.seconds.csv"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


class TestRampPoints:
    def test_midpoint_is_half_the_cap(self) -> None:
        # PERCLOS 0.10 sits halfway up the 0.05-0.15 ramp: half of 40 is 20.
        assert _ramp_points(0.10, 0.05, 0.15, 40) == 20

    def test_below_floor_is_zero_and_above_ceiling_is_the_cap(self) -> None:
        assert _ramp_points(0.04, 0.05, 0.15, 40) == 0
        assert _ramp_points(0.20, 0.05, 0.15, 40) == 40

    def test_rounds_half_up_like_javascript(self) -> None:
        # A 350 ms blink is halfway up the 250-450 ramp: 7.5 of 15, and
        # Math.round takes .5 UP to 8, where Python's round() would give 7.
        assert _ramp_points(350, 250, 450, 15) == 8


class TestRowScore:
    def test_no_face_is_no_score(self) -> None:
        row = {"faceDetected": "false", "perclos": "0.10"}
        assert _row_score(row, 0) is None

    def test_no_perclos_is_no_score(self) -> None:
        row = {"faceDetected": "true", "perclos": ""}
        assert _row_score(row, 0) is None

    def test_resting_second_scores_one_hundred(self) -> None:
        row = {
            "faceDetected": "true",
            "perclos": "0.02",
            "longClosureCount": "0",
            "lastBlinkDurationMs": "120",
            "lastBlinkAmplitudeMm": "5",
            "lastBlinkPeakVelocityMmPerS": "60",
        }
        assert _row_score(row, 0) == 100

    def test_long_closure_penalty_caps_at_thirty(self) -> None:
        # Five closures since the window opened is 5 * 15 = 75, capped at 30;
        # with PERCLOS 0.10 (20 points) the score is 100 - 50 = 50.
        row = {
            "faceDetected": "true",
            "perclos": "0.10",
            "longClosureCount": "5",
        }
        assert _row_score(row, 0) == 50


class TestHeuristicVideoScore:
    def test_medians_the_per_second_score_over_the_window(
        self, tmp_path: Path
    ) -> None:
        # Every in-window second: PERCLOS 0.10 (20), no closures (0), a 350 ms
        # blink (8), A/V = 5/22.222*1000 = 225 ms halfway up 150-300 (8).
        # Score = 100 - 36 = 64 every second, so the median is 64.
        path = _write_video(
            tmp_path,
            "s0",
            "alert",
            blink_duration=350,
            amplitude=5.0,
            velocity=22.2222222,
            perclos=0.10,
        )
        assert heuristic_video_score(path) == 64

    def test_none_when_no_second_is_scorable(self, tmp_path: Path) -> None:
        # A recording that never reaches the window has nothing to median.
        path = _write_video(tmp_path, "s0", "alert", last_second=30)
        assert heuristic_video_score(path) is None


class TestAuc:
    def test_perfect_and_reversed_and_tied(self) -> None:
        scores = np.array([1.0, 2.0, 3.0, 4.0])
        assert auc(scores, np.array([0, 0, 1, 1])) == 1.0
        assert auc(scores, np.array([1, 1, 0, 0])) == 0.0
        assert (
            auc(np.array([5.0, 5.0, 5.0, 5.0]), np.array([0, 0, 1, 1])) == 0.5
        )

    def test_ties_count_as_half(self) -> None:
        # One positive tied with one negative at the top; AUC 0.75.
        scores = np.array([1.0, 2.0, 2.0])
        assert auc(scores, np.array([0, 0, 1])) == 0.75

    def test_one_class_alone_refuses(self) -> None:
        with pytest.raises(AlertnessError):
            auc(np.array([1.0, 2.0]), np.array([1, 1]))


def _blind_heuristic_corpus(directory: Path, n_subjects: int) -> None:
    """Only blink rate separates alert from drowsy -- a feature the heuristic
    ignores entirely -- so the heuristic is blind and the model must win."""
    for i in range(n_subjects):
        _write_video(
            directory, f"s{i}", "alert", blink_rate=20.0, perclos=0.05
        )
        _write_video(
            directory, f"s{i}", "drowsy", blink_rate=4.0, perclos=0.05
        )


def _perclos_corpus(directory: Path, n_subjects: int) -> None:
    """PERCLOS separates the labels, which the heuristic weights heaviest, so
    the heuristic already wins and the model cannot beat a perfect score."""
    for i in range(n_subjects):
        _write_video(directory, f"s{i}", "alert", perclos=0.02)
        _write_video(directory, f"s{i}", "drowsy", perclos=0.30)


class TestCompare:
    def test_model_beats_a_heuristic_blind_to_the_signal(
        self, tmp_path: Path
    ) -> None:
        _blind_heuristic_corpus(tmp_path, n_subjects=6)
        result = compare(load_scored_corpus(tmp_path), shuffles=40)
        assert result.heuristic_above_chance is False
        assert result.model_beats_heuristic is True
        assert result.model_auc > result.heuristic_auc
        assert "out-separates it" in result.verdict

    def test_heuristic_wins_when_it_can_see_the_signal(
        self, tmp_path: Path
    ) -> None:
        _perclos_corpus(tmp_path, n_subjects=6)
        result = compare(load_scored_corpus(tmp_path), shuffles=40)
        assert result.heuristic_above_chance is True
        assert result.model_beats_heuristic is False
        assert "does not beat it" in result.verdict

    def test_refuses_a_corpus_without_both_extremes(
        self, tmp_path: Path
    ) -> None:
        for i in range(3):
            _write_video(tmp_path, f"s{i}", "alert", perclos=0.05)
        with pytest.raises(AlertnessError):
            compare(load_scored_corpus(tmp_path), shuffles=10)
