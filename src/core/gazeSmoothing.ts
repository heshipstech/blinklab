import type { IrisOffset } from "./gazeOffset";

// The One Euro filter (Casiez, Roussel and Vogel, 2012), the standard
// smoother for interactive pointing. The problem it solves is the
// jitter-lag tradeoff: a filter strong enough to kill jitter is too
// slow to follow a real glance, a filter fast enough to follow blurs
// nothing and smooths nothing. The escape is adaptation: smoothing
// strength follows speed. Slow signal, strong smoothing. Fast signal,
// light smoothing. Every piece is an exponential moving average, the
// adaptation itself is one linear rule.

// The filter's floor: how hard it smooths when the eye is calm.
// Lower kills more jitter but adds lag near stillness.
export const MIN_CUTOFF_HZ = 1;

// How much speed weakens the smoothing, in cutoff Hz per unit of
// speed. Speed here is offset units per second: a corner to corner
// glance moves a few units per second, jitter moves well under one.
export const SPEED_COEFFICIENT = 5;

// The speed estimate is itself noisy, so it gets its own gentle
// exponential moving average before it is trusted to steer.
export const DERIVATIVE_CUTOFF_HZ = 1;

// Turns a cutoff frequency and a frame gap into an exponential moving
// average weight. Higher cutoff or longer gap means a weight closer
// to 1, trusting the new sample more.
export function smoothingFactor(cutoffHz: number, dtS: number): number {
  const tauS = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tauS / dtS);
}

export type AxisFilterState = {
  lastTimestampMs: number;
  value: number;
  derivativePerS: number;
};

export function axisFilterStep(
  state: AxisFilterState | null,
  timestampMs: number,
  raw: number,
): AxisFilterState {
  // The first sample has no history to smooth against: it passes
  // through unchanged and becomes the history.
  if (state === null) {
    return { lastTimestampMs: timestampMs, value: raw, derivativePerS: 0 };
  }
  const dtS = (timestampMs - state.lastTimestampMs) / 1000;
  // A clock that did not advance carries no speed information and
  // would divide by zero. Refuse the sample, keep the state.
  if (dtS <= 0) {
    return state;
  }
  const rawDerivativePerS = (raw - state.value) / dtS;
  const derivativePerS =
    state.derivativePerS +
    smoothingFactor(DERIVATIVE_CUTOFF_HZ, dtS) *
      (rawDerivativePerS - state.derivativePerS);
  const cutoffHz = MIN_CUTOFF_HZ + SPEED_COEFFICIENT * Math.abs(derivativePerS);
  const value =
    state.value + smoothingFactor(cutoffHz, dtS) * (raw - state.value);
  return { lastTimestampMs: timestampMs, value, derivativePerS };
}

export type GazeSmoothingState = {
  horizontal: AxisFilterState;
  vertical: AxisFilterState;
};

export type GazeSmoothingResult = {
  state: GazeSmoothingState | null;
  smoothed: IrisOffset | null;
};

// The gaze wrapper: one independent axis filter per offset axis. A
// null offset means no trustworthy measurement existed this frame, so
// the output is null AND the filter forgets: smoothing across a gap
// would drag stale history into fresh signal, gaps stay gaps.
export function gazeSmoothingStep(
  state: GazeSmoothingState | null,
  timestampMs: number,
  offset: IrisOffset | null,
): GazeSmoothingResult {
  if (offset === null) {
    return { state: null, smoothed: null };
  }
  const horizontal = axisFilterStep(
    state?.horizontal ?? null,
    timestampMs,
    offset.horizontal,
  );
  const vertical = axisFilterStep(
    state?.vertical ?? null,
    timestampMs,
    offset.vertical,
  );
  return {
    state: { horizontal, vertical },
    smoothed: { horizontal: horizontal.value, vertical: vertical.value },
  };
}
