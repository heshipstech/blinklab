"""The pre-registered light-response analysis, checked at its decisions.

The plan (docs/pupil-light-plan.md) fixes three verdicts before any data:
detected, null, and inconclusive. Each is a different failure of the same
gauntlet -- the usable-data gate, then the permutation control -- and a bug
that quietly turned one into another would misreport the instrument. These
tests pin each verdict, the gate's two thresholds, and the phase boundaries
the analysis shares with the browser.
"""

import re
from pathlib import Path

import pytest

from blinklab.light_response import (
    LIGHT_CYCLES,
    LIGHT_PHASE_MS,
    LIGHT_SETTLE_MS,
    LIGHT_TOTAL_MS,
    LightResponseError,
    analyse_light_response,
    light_phase_at,
    stimulus_start_ms,
)

START = 1000.0


def build(
    dark_vals: list[float | None],
    bright_vals: list[float | None],
    *,
    extra: list[tuple[float, float | None]] | None = None,
) -> tuple[list[float], list[float | None]]:
    """A session's two columns: dark values in one dark slot, bright in one
    bright slot, plus any extra (elapsed, value) rows for settle/done."""
    timestamps: list[float] = []
    pupil: list[float | None] = []
    # Slot 0 is dark [20000, 40000); slot 1 is bright [40000, 60000).
    for index, value in enumerate(dark_vals):
        timestamps.append(START + LIGHT_SETTLE_MS + 1 + index)
        pupil.append(value)
    for index, value in enumerate(bright_vals):
        timestamps.append(START + LIGHT_SETTLE_MS + LIGHT_PHASE_MS + 1 + index)
        pupil.append(value)
    for elapsed, value in extra or []:
        timestamps.append(START + elapsed)
        pupil.append(value)
    return timestamps, pupil


class TestThePhaseBoundaries:
    def test_settle_covers_the_discarded_opening_including_before_zero(
        self,
    ) -> None:
        assert light_phase_at(-1) == "settle"
        assert light_phase_at(0) == "settle"
        assert light_phase_at(LIGHT_SETTLE_MS - 1) == "settle"

    def test_dark_begins_exactly_when_the_settle_ends(self) -> None:
        assert light_phase_at(LIGHT_SETTLE_MS) == "dark"
        assert light_phase_at(LIGHT_SETTLE_MS + LIGHT_PHASE_MS - 1) == "dark"

    def test_it_alternates_dark_then_bright_through_all_the_cycles(
        self,
    ) -> None:
        for slot in range(LIGHT_CYCLES * 2):
            middle = (
                LIGHT_SETTLE_MS + slot * LIGHT_PHASE_MS + LIGHT_PHASE_MS // 2
            )
            expected = "dark" if slot % 2 == 0 else "bright"
            assert light_phase_at(middle) == expected

    def test_done_at_and_after_the_end(self) -> None:
        assert light_phase_at(LIGHT_TOTAL_MS) == "done"
        assert light_phase_at(LIGHT_TOTAL_MS + 1) == "done"
        assert light_phase_at(LIGHT_TOTAL_MS - 1) == "bright"


class TestTheUsableDataGate:
    def test_a_session_the_estimator_could_not_read_is_inconclusive(
        self,
    ) -> None:
        # The real first run: 60 in-window seconds, almost all refused.
        dark: list[float | None] = [None] * 30
        bright: list[float | None] = [None] * 29 + [4.2]
        timestamps, pupil = build(dark, bright)
        result = analyse_light_response(timestamps, pupil, START)
        assert result.verdict == "inconclusive"
        assert result.gate_cleared is False
        assert result.usable_seconds == 1
        assert result.in_window_seconds == 60
        # Nothing is compared, so the medians are absent, not zero.
        assert result.median_dark_mm is None
        assert result.dark_minus_bright_mm is None

    def test_a_phase_short_of_twenty_usable_seconds_is_inconclusive(
        self,
    ) -> None:
        # Half the data is fine, but one phase is too thin to trust.
        dark = [5.0 + index * 0.01 for index in range(25)]
        bright = [4.0 + index * 0.01 for index in range(10)]
        timestamps, pupil = build(dark, bright)
        result = analyse_light_response(timestamps, pupil, START)
        assert result.verdict == "inconclusive"
        assert result.usable_bright == 10
        assert "fewer than 20" in result.reason

    def test_settle_and_done_seconds_are_not_counted_in_window(self) -> None:
        # A row in the settle and one past the end must not inflate the
        # in-window count or become a usable second.
        dark = [5.0 + index * 0.01 for index in range(25)]
        bright = [4.0 + index * 0.01 for index in range(25)]
        extra = [(1000.0, 9.9), (LIGHT_TOTAL_MS + 5000.0, 9.9)]
        timestamps, pupil = build(dark, bright, extra=extra)
        result = analyse_light_response(timestamps, pupil, START)
        assert result.in_window_seconds == 50
        assert result.usable_seconds == 50


class TestTheVerdictWhenTheGateClears:
    def test_a_clear_constriction_that_beats_the_shuffle_is_detected(
        self,
    ) -> None:
        # Non-overlapping: every dark second above every bright second, so
        # the real split is extreme and almost no shuffle reproduces it.
        dark = [5.0 + index * 0.03 for index in range(30)]
        bright = [4.0 + index * 0.03 for index in range(30)]
        timestamps, pupil = build(dark, bright)
        result = analyse_light_response(timestamps, pupil, START)
        assert result.verdict == "detected"
        assert result.dark_minus_bright_mm is not None
        assert result.dark_minus_bright_mm > 0
        assert result.dark_minus_bright_mm > result.permutation_percentile_mm
        assert result.p_one_sided < 0.025

    def test_no_real_difference_is_a_null_not_a_detection(self) -> None:
        # Dark and bright drawn from one interleaved distribution: the gate
        # clears, but there is no reflex to find.
        shared = [4.0 + index * 0.03 for index in range(60)]
        dark = shared[0::2]
        bright = shared[1::2]
        timestamps, pupil = build(dark, bright)
        result = analyse_light_response(timestamps, pupil, START)
        assert result.verdict == "null"
        assert result.gate_cleared is True
        assert result.p_one_sided >= 0.025

    def test_a_constriction_the_wrong_way_is_not_a_detection(self) -> None:
        # One-sided: bright pupils LARGER is the opposite of the reflex and
        # must never read as a success, however large.
        dark = [4.0 + index * 0.03 for index in range(30)]
        bright = [5.0 + index * 0.03 for index in range(30)]
        timestamps, pupil = build(dark, bright)
        result = analyse_light_response(timestamps, pupil, START)
        assert result.verdict == "null"
        assert result.dark_minus_bright_mm < 0


class TestReadingTheStimulusStart:
    def test_it_reads_the_logged_start(self) -> None:
        assert stimulus_start_ms({"light_stimulus_start_ms": "63708.1"}) == (
            pytest.approx(63708.1)
        )

    def test_a_session_with_no_stimulus_is_refused(self) -> None:
        with pytest.raises(LightResponseError, match="no light-response"):
            stimulus_start_ms({"source": "camera"})

    def test_a_start_that_is_not_a_number_is_refused(self) -> None:
        with pytest.raises(LightResponseError, match="not a number"):
            stimulus_start_ms({"light_stimulus_start_ms": "soon"})


class TestMismatchedColumns:
    def test_columns_of_different_lengths_are_refused(self) -> None:
        with pytest.raises(LightResponseError, match="different lengths"):
            analyse_light_response([1.0, 2.0], [3.0], START)


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEDULE_SOURCE = REPO_ROOT / "src" / "core" / "lightSchedule.ts"


class TestTheScheduleMatchesTheBrowser:
    """The browser drives the screen off src/core/lightSchedule.ts and this
    re-derives each second's phase off its own copy of the same constants. If
    the two drift apart, a second of pupil lands in the wrong phase and
    nothing else notices, so the constants are read out of the TypeScript
    source and compared, the same way the CSV contract is."""

    def _declared(self, name: str) -> int:
        source = SCHEDULE_SOURCE.read_text(encoding="utf-8")
        match = re.search(rf"export const {name} =\s*([0-9_]+)", source)
        assert match is not None, f"{name} not found in {SCHEDULE_SOURCE}"
        return int(match.group(1).replace("_", ""))

    def test_the_settle_matches(self) -> None:
        assert self._declared("LIGHT_SETTLE_MS") == LIGHT_SETTLE_MS

    def test_the_phase_length_matches(self) -> None:
        assert self._declared("LIGHT_PHASE_MS") == LIGHT_PHASE_MS

    def test_the_cycle_count_matches(self) -> None:
        assert self._declared("LIGHT_CYCLES") == LIGHT_CYCLES
