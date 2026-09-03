"""The UTA-RLDD analysis runner and its report, on SYNTHETIC data only.

The runner ties the loader, the model and the shuffle control into one
report. It is pinned here with hand-built corpora whose answer is known: a
strongly separable one must come back "detecting drowsiness", an excluded
video must be named with its reason, and a corpus with nothing measurable
must refuse rather than report on nothing. No frame or feature of the real
dataset is used."""

from __future__ import annotations

from pathlib import Path

import pytest

from blinklab.rldd import RldError, VideoFeatures, load_corpus
from tools.analyse_rldd import exclusion_reason, format_report, run_analysis

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

# Three well-separated class signatures (blink rate, blink duration,
# PERCLOS), so a model trained on other subjects classifies a held-out one.
SIGNATURE = {
    "alert": (20, 150, 0.02),
    "lowvigilant": (12, 250, 0.10),
    "drowsy": (5, 400, 0.30),
}


def _write_video(
    directory: Path,
    subject: str,
    label: str,
    *,
    fps: float = 30.0,
    last_second: int = 400,
) -> None:
    rate, duration, perclos = SIGNATURE[label]
    lines = ["# measurement_mode: stepped", ",".join(COLUMNS)]
    for second in range(last_second + 1):
        row: dict[str, object] = {
            "timestampMs": second * 1000,
            "fps": fps,
            "longClosureCount": 0,
        }
        if 60 <= second < 360:
            row["blinkRatePerMin"] = rate
            row["lastBlinkDurationMs"] = duration
            row["perclos"] = perclos
        lines.append(",".join(str(row.get(c, "")) for c in COLUMNS))
    path = directory / f"{subject}_{label}.seconds.csv"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _corpus_dir(directory: Path, n_subjects: int) -> None:
    for i in range(n_subjects):
        for label in SIGNATURE:
            _write_video(directory, f"s{i}", label)


class TestExclusionReason:
    def test_names_the_frame_rate_floor(self) -> None:
        video = _video(measured_fps=15.0, reached_window_end=True)
        assert exclusion_reason(video) == "below 25 fps (measured 15.0)"

    def test_names_the_short_window(self) -> None:
        video = _video(measured_fps=30.0, reached_window_end=False)
        assert (
            exclusion_reason(video)
            == "under five measured minutes after the settle"
        )

    def test_a_usable_video_has_no_reason(self) -> None:
        assert exclusion_reason(_video(30.0, True)) is None


def _video(measured_fps: float, reached_window_end: bool) -> VideoFeatures:
    return VideoFeatures(
        subject="s0",
        label="alert",
        measured_fps=measured_fps,
        reached_window_end=reached_window_end,
        blink_rate_per_min=10.0,
        blink_duration_ms=200.0,
        blink_amplitude_mm=None,
        closing_velocity_mm_s=None,
        amplitude_over_velocity_ms=None,
        perclos=0.1,
        long_closures=0.0,
    )


class TestRunAnalysis:
    def test_report_carries_every_section(self, tmp_path: Path) -> None:
        _corpus_dir(tmp_path, n_subjects=4)
        result = run_analysis(load_corpus(tmp_path), shuffles=15)
        report = format_report(result)
        for section in (
            "PRIMARY",
            "NEGATIVE CONTROL",
            "SECONDARY",
            "VERDICT",
            "Cite:",
        ):
            assert section in report
        assert "class balance     alert 4, lowvigilant 4, drowsy 4" in report

    def test_detects_a_strong_separable_signal(self, tmp_path: Path) -> None:
        _corpus_dir(tmp_path, n_subjects=5)
        result = run_analysis(load_corpus(tmp_path), shuffles=45)
        assert result.three_class.balanced_accuracy > 0.8
        assert result.three_control.detected is True
        assert "detecting drowsiness" in format_report(result)

    def test_excluded_video_is_named_with_its_reason(
        self, tmp_path: Path
    ) -> None:
        _corpus_dir(tmp_path, n_subjects=3)
        _write_video(tmp_path, "s9", "alert", fps=15.0)
        result = run_analysis(load_corpus(tmp_path), shuffles=15)
        assert any(v.subject == "s9" for v, _ in result.excluded)
        report = format_report(result)
        assert "s9_alert" in report
        assert "below 25 fps" in report

    def test_refuses_a_corpus_with_nothing_usable(
        self, tmp_path: Path
    ) -> None:
        _write_video(tmp_path, "s0", "alert", fps=15.0)
        with pytest.raises(RldError):
            run_analysis(load_corpus(tmp_path), shuffles=10)
