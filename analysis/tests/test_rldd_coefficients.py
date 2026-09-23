"""The per-subject table and the standardised coefficients (roadmap
10.10c3).

The real table comes from the owner's UTA-RLDD feature records; these
tests pin the two structural claims the row's Check names, on synthetic
VideoFeatures: the per-subject rows sum down to the pooled class
balance, and the coefficients are a deterministic function of the
records that reflects their direction.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

from blinklab.rldd import (
    CONTAINER_NOT_CHECKED,
    LABELS,
    RldError,
    VideoFeatures,
    standardized_coefficients,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from rldd_coefficients import (  # noqa: E402
    format_report,
    main,
    per_subject_label_counts,
)

_FEATURE_NAMES = (
    "blink_rate_per_min",
    "blink_duration_ms",
    "blink_amplitude_mm",
    "closing_velocity_mm_s",
    "amplitude_over_velocity_ms",
    "perclos",
    "long_closures",
)


def _video(
    subject: str,
    label: str,
    vector: list[float],
    *,
    measured_fps: float = 30.0,
    reached_window_end: bool = True,
) -> VideoFeatures:
    return VideoFeatures(
        subject=subject,
        label=label,
        measured_fps=measured_fps,
        reached_window_end=reached_window_end,
        **dict(zip(_FEATURE_NAMES, vector, strict=True)),
    )


def _separable_corpus(n_subjects: int = 8) -> list[VideoFeatures]:
    """Each subject near the same three centroids, alert high on feature
    zero and drowsy low, so the fit learns a clear direction."""
    rng = np.random.default_rng(0)
    centroid = {
        "alert": np.array([3.0, 3.0, 0, 0, 0, 0, 0]),
        "lowvigilant": np.array([0.0, 0.0, 0, 0, 0, 0, 0]),
        "drowsy": np.array([-3.0, -3.0, 0, 0, 0, 0, 0]),
    }
    videos: list[VideoFeatures] = []
    for s in range(n_subjects):
        for label in LABELS:
            vector = centroid[label] + rng.normal(0, 0.3, 7)
            videos.append(_video(f"s{s}", label, vector.tolist()))
    return videos


class TestStandardizedCoefficients:
    def test_the_shape_is_feature_by_class(self) -> None:
        model = standardized_coefficients(_separable_corpus())
        assert model.coefficients.shape == (len(_FEATURE_NAMES), len(LABELS))
        assert model.feature_names == _FEATURE_NAMES
        assert model.labels == LABELS

    def test_the_coefficients_recompute_identically(self) -> None:
        # Deterministic: a zero start and a fixed step mean the same
        # records always give the same coefficients, byte for byte.
        corpus = _separable_corpus()
        first = standardized_coefficients(corpus).coefficients
        second = standardized_coefficients(corpus).coefficients
        assert np.array_equal(first, second)

    def test_the_coefficients_reflect_the_records_direction(self) -> None:
        # Feature zero rises with alertness in the records, so its alert
        # coefficient must sit above its drowsy one — the fit read the
        # records, not noise.
        model = standardized_coefficients(_separable_corpus())
        alert = model.labels.index("alert")
        drowsy = model.labels.index("drowsy")
        assert model.coefficients[0][alert] > model.coefficients[0][drowsy]

    def test_no_usable_videos_is_refused(self) -> None:
        unusable = [
            _video("s0", "alert", [1.0] * 7, measured_fps=5.0),
        ]
        with pytest.raises(RldError, match="usable"):
            standardized_coefficients(unusable)


class TestPerSubjectTable:
    def test_rows_sum_to_the_pooled_class_balance(self) -> None:
        # Three subjects, each with one video per class: the pooled
        # balance is three of each, and it must be the column sums.
        videos = [
            _video(f"s{s}", label, [1.0] * 7)
            for s in range(3)
            for label in LABELS
        ]
        counts = per_subject_label_counts(videos)
        assert set(counts) == {"s0", "s1", "s2"}
        for label in LABELS:
            assert sum(row[label] for row in counts.values()) == 3

    def test_the_totals_sum_to_the_usable_count(self) -> None:
        videos = [
            _video(f"s{s}", label, [1.0] * 7)
            for s in range(4)
            for label in LABELS
        ]
        counts = per_subject_label_counts(videos)
        total = sum(sum(row.values()) for row in counts.values())
        assert total == len(videos)

    def test_an_excluded_video_is_not_counted(self) -> None:
        # A sub-floor video is not in the pooled numbers this must sum to,
        # so it must not appear in the per-subject table either.
        videos = [
            _video("s0", "alert", [1.0] * 7),
            _video("s0", "drowsy", [1.0] * 7, measured_fps=5.0),
        ]
        counts = per_subject_label_counts(videos)
        assert counts["s0"]["alert"] == 1
        assert counts["s0"]["drowsy"] == 0


class TestFormatReport:
    def test_it_names_each_subject_a_feature_and_the_pooled_row(self) -> None:
        text = format_report(_separable_corpus(n_subjects=3))
        assert "s0" in text
        assert "s2" in text
        assert "pooled" in text
        assert "blink_rate_per_min" in text


_COLUMNS = [
    "timestampMs",
    "fps",
    "blinkRatePerMin",
    "lastBlinkDurationMs",
    "perclos",
    "longClosureCount",
]


def _write_measured(directory: Path, n_subjects: int) -> None:
    """The seconds files a corpus run writes, 401 measured seconds each,
    with one blink signature per label inside the 60-360 s window."""
    signature = {
        "alert": (20, 150, 0.02),
        "lowvigilant": (12, 250, 0.10),
        "drowsy": (5, 400, 0.30),
    }
    for s in range(n_subjects):
        for label, (rate, duration, perclos) in signature.items():
            lines = ["# measurement_mode: stepped", ",".join(_COLUMNS)]
            for second in range(401):
                cells = [second * 1000, 30.0, "", "", "", 0]
                if 60 <= second < 360:
                    cells[2:5] = [rate, duration, perclos]
                lines.append(",".join(str(cell) for cell in cells))
            path = directory / f"s{s}_{label}.seconds.csv"
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_manifest(path: Path, n_subjects: int, suffix: str = "") -> None:
    rows = ["clip,rFrameRate,avgFrameRate,nbReadPackets"]
    for s in range(n_subjects):
        for label in LABELS:
            rows.append(f"s{s}_{label}{suffix},30/1,30/1,12030")
    path.write_text("\n".join(rows) + "\n", encoding="utf-8")


class TestTheCommandTakesTheManifest:
    """Roadmap 10.14b. The table reads the same feature records the
    analysis does, so it takes the same container cross-check and states
    it the same way."""

    def test_the_report_says_the_check_did_not_run_without_one(self) -> None:
        text = format_report(_separable_corpus(n_subjects=3))
        assert CONTAINER_NOT_CHECKED in text

    def test_a_matching_manifest_is_named_in_the_report(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        measured = tmp_path / "measured"
        measured.mkdir()
        _write_measured(measured, n_subjects=2)
        manifest = tmp_path / "manifest.csv"
        _write_manifest(manifest, n_subjects=2)
        assert main([str(measured), "--manifest", str(manifest)]) == 0
        printed = capsys.readouterr().out
        assert "container check   6 of 6 clips within" in printed

    def test_a_manifest_naming_no_clip_refuses_the_table(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        measured = tmp_path / "measured"
        measured.mkdir()
        _write_measured(measured, n_subjects=2)
        manifest = tmp_path / "manifest.csv"
        _write_manifest(manifest, n_subjects=2, suffix=".mp4")
        assert main([str(measured), "--manifest", str(manifest)]) == 1
        assert "names none of the 6" in capsys.readouterr().err
