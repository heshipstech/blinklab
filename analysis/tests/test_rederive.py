"""Re-deriving the RLDD rate under the observed-time definition.

Roadmap 10.12b's third Check clause. The retained RLDD per-second
files carry `blinkRatePerMin` as the app computed it WHEN THEY WERE
EXPORTED — a rolling count divided by the wall clock — and 10.12b
changed the live definition to divide by observed time instead. The
files cannot be re-exported without re-measuring, so the honest move
is to re-derive the rate from what the files already hold: the blink
events in the paired blink log, over the seconds the instrument
actually measured a face. Everything here is synthetic: rates known
by construction, a face-loss stretch whose dilution the old column
kept and the re-derivation removes.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from blinklab.rederive import (
    RederiveError,
    rederive_directory,
    rederive_video,
)
from blinklab.rldd import WINDOW_END_S, WINDOW_START_S

SECONDS_COLUMNS = [
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

BLINK_COLUMNS = [
    "startFrame",
    "endFrame",
    "atMs",
    "durationMs",
    "amplitudeMm",
    "peakClosingVelocityMmPerS",
    "amplitudeOverVelocityMs",
]


def _write_seconds(
    path: Path,
    *,
    last_second: int = 400,
    aperture_of=None,
    column_rate: float = 17.0,
) -> None:
    lines = ["# measurement_mode: stepped", ",".join(SECONDS_COLUMNS)]
    for second in range(last_second + 1):
        aperture = 8.0 if aperture_of is None else aperture_of(second)
        row = {
            "timestampMs": second * 1000,
            "faceDetected": "true" if aperture != "" else "false",
            "fps": 30.0,
            "apertureMm": aperture,
            "blinkRatePerMin": column_rate,
        }
        lines.append(",".join(str(row.get(c, "")) for c in SECONDS_COLUMNS))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_blinks(path: Path, at_ms: list[int]) -> None:
    lines = [f"# blinks_detected: {len(at_ms)}", ",".join(BLINK_COLUMNS)]
    for at in at_ms:
        row = {
            "startFrame": "",
            "endFrame": "",
            "atMs": at,
            "durationMs": 120,
            "amplitudeMm": 4.0,
            "peakClosingVelocityMmPerS": 80.0,
            "amplitudeOverVelocityMs": 50.0,
        }
        lines.append(",".join(str(row.get(c, "")) for c in BLINK_COLUMNS))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _window_blinks(count: int) -> list[int]:
    """`count` blink times spread inside the analysis window."""
    span_ms = (WINDOW_END_S - WINDOW_START_S) * 1000
    return [
        WINDOW_START_S * 1000 + (k * span_ms) // count for k in range(count)
    ]


class TestRederiveVideo:
    def test_old_from_the_frozen_column_new_from_events_over_observed(
        self, tmp_path: Path
    ) -> None:
        # The old number is the published derivation itself — the
        # window median of the exported column — and the new one is 20
        # blinks over the 300 fully-observed window seconds: 4.0 per
        # minute, whatever the frozen column claims.
        seconds = tmp_path / "s1_alert.seconds.csv"
        blinks = tmp_path / "s1_alert.blinks.csv"
        _write_seconds(seconds, column_rate=17.0)
        _write_blinks(blinks, _window_blinks(20))
        result = rederive_video(seconds, blinks)
        assert result.name == "s1_alert"
        assert result.old_rate_per_min == 17.0
        assert result.blink_count == 20
        assert result.observed_seconds == WINDOW_END_S - WINDOW_START_S
        assert result.new_rate_per_min == pytest.approx(4.0)

    def test_face_loss_stops_diluting_the_rate(self, tmp_path: Path) -> None:
        # Half the window has no measured aperture: the same 20 blinks
        # over 150 observed seconds read 8 per minute, where a wall
        # clock denominator would have kept reading 4 — the exact
        # dilution 10.12b removed from the live path.
        seconds = tmp_path / "s1_drowsy.seconds.csv"
        blinks = tmp_path / "s1_drowsy.blinks.csv"
        _write_seconds(
            seconds,
            aperture_of=lambda s: 8.0 if s % 2 == 0 else "",
        )
        _write_blinks(blinks, _window_blinks(20))
        result = rederive_video(seconds, blinks)
        assert result.observed_seconds == (WINDOW_END_S - WINDOW_START_S) // 2
        assert result.new_rate_per_min == pytest.approx(8.0)

    def test_blinks_outside_the_window_are_not_counted(
        self, tmp_path: Path
    ) -> None:
        seconds = tmp_path / "s1_alert.seconds.csv"
        blinks = tmp_path / "s1_alert.blinks.csv"
        _write_seconds(seconds)
        _write_blinks(
            blinks,
            [
                10_000,  # before the window
                *_window_blinks(5),
                (WINDOW_END_S + 10) * 1000,  # after it
            ],
        )
        result = rederive_video(seconds, blinks)
        assert result.blink_count == 5

    def test_zero_observed_seconds_is_a_refusal_not_a_zero(
        self, tmp_path: Path
    ) -> None:
        # No observed second in the window: dividing would invent an
        # infinite rate and zero would invent a calm one. Null it is.
        seconds = tmp_path / "s1_alert.seconds.csv"
        blinks = tmp_path / "s1_alert.blinks.csv"
        _write_seconds(seconds, aperture_of=lambda s: "")
        _write_blinks(blinks, _window_blinks(3))
        result = rederive_video(seconds, blinks)
        assert result.observed_seconds == 0
        assert result.new_rate_per_min is None

    def test_a_missing_blink_log_is_refused_by_name(
        self, tmp_path: Path
    ) -> None:
        seconds = tmp_path / "s1_alert.seconds.csv"
        _write_seconds(seconds)
        with pytest.raises(RederiveError, match="s1_alert.blinks.csv"):
            rederive_video(seconds, tmp_path / "s1_alert.blinks.csv")


class TestRederiveDirectory:
    def test_pairs_every_seconds_file_with_its_blink_log(
        self, tmp_path: Path
    ) -> None:
        for name in ["s1_alert", "s2_drowsy"]:
            _write_seconds(tmp_path / f"{name}.seconds.csv")
            _write_blinks(tmp_path / f"{name}.blinks.csv", _window_blinks(10))
        results = rederive_directory(tmp_path)
        assert [r.name for r in results] == ["s1_alert", "s2_drowsy"]
        assert all(r.new_rate_per_min == pytest.approx(2.0) for r in results)

    def test_an_unpaired_seconds_file_refuses_the_whole_directory(
        self, tmp_path: Path
    ) -> None:
        # One missing pair poisons a comparison across the corpus, so
        # the directory refuses by name rather than quietly narrowing
        # to the files that happen to have logs.
        _write_seconds(tmp_path / "s1_alert.seconds.csv")
        _write_blinks(tmp_path / "s1_alert.blinks.csv", _window_blinks(4))
        _write_seconds(tmp_path / "s2_drowsy.seconds.csv")
        with pytest.raises(RederiveError, match="s2_drowsy.blinks.csv"):
            rederive_directory(tmp_path)

    def test_an_empty_directory_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(RederiveError, match="no .*seconds.csv"):
            rederive_directory(tmp_path)
