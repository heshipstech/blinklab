"""The alertness-comparison runner and its report, on SYNTHETIC data only.

The runner ties the heuristic port, the learned model and the two shuffle
controls into one report. It is pinned here with a hand-built corpus whose
answer is known, and a corpus with nothing to compare must refuse rather than
report on nothing. No frame or feature of the real dataset is used."""

from __future__ import annotations

from pathlib import Path

from blinklab.alertness import compare, load_scored_corpus
from tools.compare_alertness import format_report, main

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
    directory: Path, subject: str, label: str, perclos: float
) -> None:
    lines = ["# measurement_mode: stepped", ",".join(COLUMNS)]
    for second in range(401):
        row: dict[str, object] = {
            "timestampMs": second * 1000,
            "faceDetected": "true",
            "fps": 30.0,
            "longClosureCount": 0,
        }
        if 60 <= second < 360:
            row["perclos"] = perclos
        lines.append(",".join(str(row.get(c, "")) for c in COLUMNS))
    (directory / f"{subject}_{label}.seconds.csv").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def _separable_corpus(directory: Path, n_subjects: int) -> None:
    # PERCLOS separates the two states, so the report has a real verdict.
    for i in range(n_subjects):
        _write_video(directory, f"s{i}", "alert", perclos=0.02)
        _write_video(directory, f"s{i}", "drowsy", perclos=0.30)


class TestFormatReport:
    def test_report_carries_every_section(self, tmp_path: Path) -> None:
        _separable_corpus(tmp_path, n_subjects=6)
        result = compare(load_scored_corpus(tmp_path), shuffles=20)
        report = format_report(result)
        for section in (
            "PRIMARY",
            "BAR 1",
            "BAR 2",
            "SECONDARY",
            "VERDICT",
            "Cite:",
        ):
            assert section in report
        assert "alert 6, drowsy 6" in report

    def test_report_keeps_the_live_meter_caveat(self, tmp_path: Path) -> None:
        _separable_corpus(tmp_path, n_subjects=6)
        result = compare(load_scored_corpus(tmp_path), shuffles=20)
        assert "NOT a live per-person meter" in format_report(result)


class TestMain:
    def test_refuses_a_corpus_with_one_state(self, tmp_path: Path) -> None:
        # Exercises the runner's argument parsing and error path (the
        # `python -m` invocation the UTA-RLDD runner's own bug hid in); the
        # happy path is left to the fast format_report tests above, which do
        # not pay for the full 1000-shuffle default.
        for i in range(3):
            _write_video(tmp_path, f"s{i}", "alert", perclos=0.05)
        assert main([str(tmp_path)]) == 1
