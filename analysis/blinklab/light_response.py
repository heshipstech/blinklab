"""The pre-registered light-response analysis (docs/pupil-light-plan.md, 9.4).

Given a recorded session and the stimulus start the app logged, sort every
in-window second into dark or bright by the SAME fixed schedule the screen
ran, drop the discarded settle and the estimator's refusals, and answer one
question committed before the data: is the pupil smaller in the bright
phases, by more than a 1000-shuffle permutation control allows?

The usable-data gate comes first, deliberately. A session in which the
estimator refused most frames cannot answer the question either way, and
being forced to a number there would manufacture a result out of noise. So a
session that does not clear the gate is reported as INCONCLUSIVE -- a fact
about the instrument in that room -- rather than as a null.

Nothing here reads a frame or an identity. It takes two columns of numbers
and the one timestamp the app wrote, and returns a verdict and the counts
behind it.
"""

from __future__ import annotations

import random
import statistics
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

# A mirror of src/core/lightSchedule.ts. The browser drives the screen off
# those constants; this re-derives each second's phase off the same ones, so
# a drift between them would silently mislabel pupil into the wrong phase.
# tests/test_light_response.py reads the TypeScript source and compares.
LIGHT_SETTLE_MS = 20_000
LIGHT_PHASE_MS = 20_000
LIGHT_CYCLES = 6
LIGHT_TOTAL_MS = LIGHT_SETTLE_MS + LIGHT_CYCLES * 2 * LIGHT_PHASE_MS

# The usable-data gate, fixed in the plan before any camera ran.
MIN_USABLE_FRACTION = 0.5
MIN_USABLE_PER_PHASE = 20

# The negative control, also fixed in advance: the reflex direction is known
# (dark pupils larger), so the test is one-sided and the observed
# dark-minus-bright difference must clear the 97.5th percentile of the
# shuffled null (a one-sided permutation p below 0.025).
PERMUTATIONS = 1000
PERMUTATION_SEED = 20260904
SIGNIFICANCE_PERCENTILE = 97.5

DETECTED = "detected"
NULL = "null"
INCONCLUSIVE = "inconclusive"


class LightResponseError(ValueError):
    """A session that cannot be analysed for the light response, named."""


@dataclass
class LightResponseResult:
    """One session's answer, and every count the verdict was drawn from."""

    verdict: str  # DETECTED | NULL | INCONCLUSIVE
    in_window_seconds: int
    usable_seconds: int
    usable_dark: int
    usable_bright: int
    usable_fraction: float
    gate_cleared: bool
    # Why the gate was not cleared, or "" when it was.
    reason: str
    # None until the gate is cleared: an inconclusive session has no medians
    # to compare, and reporting them would imply a comparison that the gate
    # says cannot be trusted.
    median_dark_mm: float | None
    median_bright_mm: float | None
    dark_minus_bright_mm: float | None
    permutation_percentile_mm: float | None
    p_one_sided: float | None


def light_phase_at(elapsed_ms: float) -> str:
    """The phase the screen showed `elapsed_ms` after the stimulus started.

    Settle covers everything before the first cycle (a negative elapsed
    included, so a row before the start cannot read as a measured phase);
    "done" covers everything at or past the end; between, each 20-second slot
    alternates dark, bright, dark, ... because every cycle is dark THEN
    bright.
    """
    if elapsed_ms < LIGHT_SETTLE_MS:
        return "settle"
    if elapsed_ms >= LIGHT_TOTAL_MS:
        return "done"
    slot = int((elapsed_ms - LIGHT_SETTLE_MS) // LIGHT_PHASE_MS)
    return "dark" if slot % 2 == 0 else "bright"


def stimulus_start_ms(metadata: dict[str, str]) -> float:
    """The stimulus's moment-zero the app logged, or a named refusal.

    A session with no light-response stimulus carries no such row, and
    analysing it would invent a schedule that never ran.
    """
    raw = metadata.get("light_stimulus_start_ms")
    if raw is None:
        raise LightResponseError(
            "this session carries no light_stimulus_start_ms, so no "
            "light-response stimulus ran during it"
        )
    try:
        return float(raw)
    except ValueError as error:
        raise LightResponseError(
            f"the light_stimulus_start_ms {raw!r} is not a number"
        ) from error


def _usable(value: float | None) -> bool:
    """A second is usable only when the estimator returned a real value.

    NaN and None are the estimator's refusal (null-never-zero), and a
    non-positive diameter is not a diameter, so both are dropped rather than
    averaged in as if they were measurements.
    """
    return value is not None and np.isfinite(value) and value > 0


def analyse_light_response(
    timestamps_ms: Sequence[float],
    pupil_mm: Sequence[float | None],
    start_ms: float,
) -> LightResponseResult:
    """Run the pre-registered analysis on one session's two columns."""
    if len(timestamps_ms) != len(pupil_mm):
        raise LightResponseError(
            "timestamps and pupil values are different lengths, so they "
            "cannot be the same session"
        )

    dark: list[float] = []
    bright: list[float] = []
    in_window = 0
    for timestamp, value in zip(timestamps_ms, pupil_mm, strict=True):
        phase = light_phase_at(timestamp - start_ms)
        if phase not in ("dark", "bright"):
            continue
        in_window += 1
        if _usable(value):
            (dark if phase == "dark" else bright).append(float(value))

    usable = len(dark) + len(bright)
    fraction = usable / in_window if in_window > 0 else 0.0

    reasons: list[str] = []
    if fraction < MIN_USABLE_FRACTION:
        reasons.append(
            f"only {usable} of {in_window} in-window seconds carried a "
            f"pupil value ({fraction:.1%}), below the "
            f"{MIN_USABLE_FRACTION:.0%} the estimator has to resolve"
        )
    if len(dark) < MIN_USABLE_PER_PHASE or len(bright) < MIN_USABLE_PER_PHASE:
        reasons.append(
            f"a phase has fewer than {MIN_USABLE_PER_PHASE} usable seconds "
            f"(dark {len(dark)}, bright {len(bright)})"
        )

    if reasons:
        return LightResponseResult(
            verdict=INCONCLUSIVE,
            in_window_seconds=in_window,
            usable_seconds=usable,
            usable_dark=len(dark),
            usable_bright=len(bright),
            usable_fraction=fraction,
            gate_cleared=False,
            reason="; ".join(reasons),
            median_dark_mm=None,
            median_bright_mm=None,
            dark_minus_bright_mm=None,
            permutation_percentile_mm=None,
            p_one_sided=None,
        )

    median_dark = statistics.median(dark)
    median_bright = statistics.median(bright)
    observed = median_dark - median_bright

    percentile, p_one_sided = _permutation_control(dark, bright, observed)
    detected = observed > 0 and observed > percentile
    return LightResponseResult(
        verdict=DETECTED if detected else NULL,
        in_window_seconds=in_window,
        usable_seconds=usable,
        usable_dark=len(dark),
        usable_bright=len(bright),
        usable_fraction=fraction,
        gate_cleared=True,
        reason="",
        median_dark_mm=median_dark,
        median_bright_mm=median_bright,
        dark_minus_bright_mm=observed,
        permutation_percentile_mm=percentile,
        p_one_sided=p_one_sided,
    )


def _permutation_control(
    dark: list[float], bright: list[float], observed: float
) -> tuple[float, float]:
    """Shuffle the phase labels 1000 times from one fixed seed.

    The values are held fixed and the dark/bright labels reshuffled, so the
    null is "the same pupils, with the light phase forgotten". The observed
    difference has to sit above the 97.5th percentile of that null to count,
    and the one-sided p is the share of shuffles at least as large.
    """
    values = dark + bright
    labels = [True] * len(dark) + [False] * len(bright)
    rng = random.Random(PERMUTATION_SEED)
    differences: list[float] = []
    for _ in range(PERMUTATIONS):
        shuffled = labels[:]
        rng.shuffle(shuffled)
        pairs = list(zip(values, shuffled, strict=True))
        as_dark = [v for v, is_dark in pairs if is_dark]
        as_bright = [v for v, is_dark in pairs if not is_dark]
        differences.append(
            statistics.median(as_dark) - statistics.median(as_bright)
        )
    percentile = float(np.percentile(differences, SIGNIFICANCE_PERCENTILE))
    at_least = sum(1 for d in differences if d >= observed)
    return percentile, at_least / PERMUTATIONS
