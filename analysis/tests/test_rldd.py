"""The UTA-RLDD classifier, tested on SYNTHETIC data only.

No frame or feature of UTA-RLDD is in this repository, and none is needed
to test the pipeline: the loader is pinned with hand-written CSVs whose
medians are known by construction, and the model and evaluation are pinned
with synthetic corpora where the answer is known — a separable signal must
be found and must survive the shuffle, pure noise must not. This is how a
classifier is tested honestly before it ever meets the real labels."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from blinklab.rldd import (
    LABELS,
    RldError,
    VideoFeatures,
    balanced_accuracy,
    label_of,
    leave_one_subject_out,
    load_corpus,
    load_video_features,
    shuffle_control,
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


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    lines = ["# measurement_mode: stepped", ",".join(COLUMNS)]
    for row in rows:
        lines.append(",".join(str(row.get(c, "")) for c in COLUMNS))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _rows(
    *,
    fps: float = 30.0,
    last_second: int = 400,
    in_window: dict[str, object] | None = None,
    outside: dict[str, object] | None = None,
    long_closure=None,
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for second in range(last_second + 1):
        row: dict[str, object] = {
            "timestampMs": second * 1000,
            "faceDetected": "true",
            "fps": fps,
            "longClosureCount": long_closure(second) if long_closure else 0,
        }
        values = in_window if 60 <= second < 360 else outside
        if values:
            row.update(values)
        rows.append(row)
    return rows


# --- loader: the medians, the window, the two special features ----------


class TestFeatureExtraction:
    def test_medians_are_taken_over_the_window_only(
        self, tmp_path: Path
    ) -> None:
        # In-window values must win; the settle and the tail must not leak.
        path = tmp_path / "s1_alert.seconds.csv"
        _write_csv(
            path,
            _rows(
                in_window={
                    "blinkRatePerMin": 12,
                    "lastBlinkDurationMs": 200,
                    "lastBlinkAmplitudeMm": 4.0,
                    "lastBlinkPeakVelocityMmPerS": 100,
                    "perclos": 0.1,
                },
                outside={
                    "blinkRatePerMin": 999,
                    "lastBlinkDurationMs": 999,
                    "lastBlinkAmplitudeMm": 999,
                    "lastBlinkPeakVelocityMmPerS": 999,
                    "perclos": 999,
                },
            ),
        )
        video = load_video_features(path)
        assert video.blink_rate_per_min == 12
        assert video.blink_duration_ms == 200
        assert video.blink_amplitude_mm == 4.0
        assert video.closing_velocity_mm_s == 100
        assert video.perclos == 0.1
        assert video.amplitude_over_velocity_ms == 40.0  # 4/100*1000
        assert video.usable is True

    def test_ratio_is_median_of_per_second_ratios(
        self, tmp_path: Path
    ) -> None:
        # Half the window at ratio 40, half at ratio 20; the median of the
        # per-second ratios is 30, which the ratio of the medians (26.67)
        # is not — so this proves the ratio is formed per second.
        rows: list[dict[str, object]] = []
        for second in range(401):
            row: dict[str, object] = {
                "timestampMs": second * 1000,
                "fps": 30,
                "longClosureCount": 0,
            }
            if 60 <= second < 360:
                row["lastBlinkAmplitudeMm"] = 4.0
                row["lastBlinkPeakVelocityMmPerS"] = (
                    100 if second < 210 else 200
                )
            rows.append(row)
        path = tmp_path / "s1_drowsy.seconds.csv"
        _write_csv(path, rows)
        video = load_video_features(path)
        assert video.amplitude_over_velocity_ms == 30.0

    def test_long_closures_is_the_window_delta(self, tmp_path: Path) -> None:
        # Cumulative counter: 3 before the window, rising to 10 inside it.
        # The feature is the closures DURING the window, 10 - 3 = 7, which
        # the in-window maximum (10) is not.
        path = tmp_path / "s1_drowsy.seconds.csv"
        _write_csv(
            path,
            _rows(
                long_closure=lambda s: 3 if s < 60 else 10 if s < 360 else 12
            ),
        )
        video = load_video_features(path)
        assert video.long_closures == 7

    def test_the_fps_floor_marks_a_slow_video_unusable(
        self, tmp_path: Path
    ) -> None:
        path = tmp_path / "s1_alert.seconds.csv"
        _write_csv(path, _rows(fps=15))
        video = load_video_features(path)
        assert video.measured_fps == 15
        assert video.usable is False

    def test_a_short_recording_is_unusable(self, tmp_path: Path) -> None:
        # Stops at second 200, never reaching the five-minute window's end.
        path = tmp_path / "s1_alert.seconds.csv"
        _write_csv(path, _rows(last_second=200))
        video = load_video_features(path)
        assert video.reached_window_end is False
        assert video.usable is False

    def test_an_unmeasured_feature_is_none_not_zero(
        self, tmp_path: Path
    ) -> None:
        # No blink columns anywhere: blink features are None (not measured),
        # while perclos and long closures, always emitted, stay numbers.
        path = tmp_path / "s1_alert.seconds.csv"
        _write_csv(path, _rows(in_window={"perclos": 0.05}))
        video = load_video_features(path)
        assert video.blink_rate_per_min is None
        assert video.blink_duration_ms is None
        assert video.perclos == 0.05
        assert video.long_closures == 0


class TestNaming:
    def test_label_is_read_from_a_known_suffix(self) -> None:
        assert label_of("Fold1part1_01_alert") == "alert"
        assert label_of("Fold1part1_01_lowvigilant") == "lowvigilant"
        assert label_of("Fold1part1_01_drowsy") == "drowsy"
        assert label_of("Fold1part1_01_notes") is None

    def test_subject_keeps_its_underscores(self, tmp_path: Path) -> None:
        path = tmp_path / "Fold1part1_01_drowsy.seconds.csv"
        _write_csv(path, _rows())
        video = load_video_features(path)
        assert video.subject == "Fold1part1_01"
        assert video.label == "drowsy"

    def test_refuses_a_file_with_no_known_label(self, tmp_path: Path) -> None:
        path = tmp_path / "clip_003.seconds.csv"
        _write_csv(path, _rows())
        with pytest.raises(RldError):
            load_video_features(path)

    def test_load_corpus_reads_sorted_and_refuses_empty(
        self, tmp_path: Path
    ) -> None:
        for name in ("s2_alert", "s1_drowsy"):
            _write_csv(tmp_path / f"{name}.seconds.csv", _rows())
        corpus = load_corpus(tmp_path)
        assert [v.subject for v in corpus] == ["s1", "s2"]
        with pytest.raises(RldError):
            load_corpus(tmp_path / "empty")


# --- the model and the evaluation ---------------------------------------


def _video(subject: str, label: str, vector: list[float]) -> VideoFeatures:
    names = (
        "blink_rate_per_min",
        "blink_duration_ms",
        "blink_amplitude_mm",
        "closing_velocity_mm_s",
        "amplitude_over_velocity_ms",
        "perclos",
        "long_closures",
    )
    return VideoFeatures(
        subject=subject,
        label=label,
        measured_fps=30.0,
        reached_window_end=True,
        **dict(zip(names, vector, strict=True)),
    )


def _separable_corpus(
    n_subjects: int = 8, seed: int = 0
) -> list[VideoFeatures]:
    """Every subject sits near the same three class centroids, so a model
    trained on other subjects generalises to a held-out one."""
    rng = np.random.default_rng(seed)
    centroid = {
        "alert": np.array([3.0, 3.0, 0, 0, 0, 0, 0]),
        "lowvigilant": np.array([0.0, 0.0, 0, 0, 0, 0, 0]),
        "drowsy": np.array([-3.0, -3.0, 0, 0, 0, 0, 0]),
    }
    videos: list[VideoFeatures] = []
    for s in range(n_subjects):
        for label in LABELS:
            vec = centroid[label] + rng.normal(0, 0.3, 7)
            videos.append(_video(f"s{s}", label, vec.tolist()))
    return videos


def _unlearnable_corpus(n_subjects: int = 8) -> list[VideoFeatures]:
    """Identical features regardless of label: nothing to learn, so
    leave-one-subject-out can only reach the 1/3 chance floor."""
    videos: list[VideoFeatures] = []
    for s in range(n_subjects):
        for label in LABELS:
            videos.append(_video(f"s{s}", label, [1.0] * 7))
    return videos


class TestBalancedAccuracy:
    def test_perfect_and_chance(self) -> None:
        truth = np.array([0, 1, 2, 0, 1, 2])
        assert balanced_accuracy(truth, truth, 3) == 1.0
        # Always predicting class 0: recall 1 on class 0, 0 on the others.
        allzero = np.zeros(6, dtype=int)
        assert balanced_accuracy(truth, allzero, 3) == pytest.approx(1 / 3)


class TestLeaveOneSubjectOut:
    def test_recovers_a_separable_signal(self) -> None:
        result = leave_one_subject_out(_separable_corpus())
        assert result.balanced_accuracy > 0.8
        assert result.confusion.sum() == 24  # 8 subjects x 3 videos

    def test_reaches_only_chance_when_unlearnable(self) -> None:
        result = leave_one_subject_out(_unlearnable_corpus())
        assert result.balanced_accuracy == pytest.approx(1 / 3)

    def test_is_deterministic(self) -> None:
        corpus = _separable_corpus()
        first = leave_one_subject_out(corpus)
        second = leave_one_subject_out(corpus)
        assert np.array_equal(first.predicted, second.predicted)

    def test_counts_imputed_cells(self) -> None:
        corpus = _separable_corpus(n_subjects=4)
        holed = list(corpus)
        holed[0] = _video("s0", "alert", [np.nan, 3, 0, 0, 0, 0, 0])
        result = leave_one_subject_out(holed)
        assert result.imputed_cells == 1

    def test_per_subject_scores_are_reported(self) -> None:
        result = leave_one_subject_out(_separable_corpus(n_subjects=5))
        scores = result.per_subject_accuracy()
        assert set(scores) == {"s0", "s1", "s2", "s3", "s4"}


class TestShuffleControl:
    def test_detects_a_genuine_signal(self) -> None:
        # 45 shuffles is enough for the decision rule: an observed accuracy
        # above every one of them gives p = 1/46 = 0.022, under 0.025. What
        # is asserted is DETECTION — observed clear of its own shuffled null
        # and of the floor — not a particular accuracy.
        control = shuffle_control(_separable_corpus(n_subjects=8), shuffles=45)
        assert control.observed > control.floor
        assert control.observed > control.null_percentile_975
        assert control.detected is True
        assert control.p_value < 0.025

    def test_is_not_fooled_by_no_signal(self) -> None:
        control = shuffle_control(
            _unlearnable_corpus(n_subjects=5), shuffles=45
        )
        # Chance sits inside its own shuffled null, so nothing is detected.
        assert control.detected is False

    def test_same_seed_same_null(self) -> None:
        corpus = _separable_corpus(n_subjects=5)
        first = shuffle_control(corpus, shuffles=20, seed=7)
        second = shuffle_control(corpus, shuffles=20, seed=7)
        assert np.array_equal(first.null, second.null)


class TestBinarySecondary:
    def test_runs_on_alert_versus_drowsy_only(self) -> None:
        result = leave_one_subject_out(
            _separable_corpus(), labels=("alert", "drowsy")
        )
        # Two classes, so two videos per subject reach the pool.
        assert result.confusion.sum() == 16
        assert result.balanced_accuracy > 0.8
