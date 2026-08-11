import {
  BLINK_RATE_MIN_OBSERVATION_MS,
  BLINK_RATE_WINDOW_MS,
} from "./constants";
import { keepRecent } from "./fps";
import { measurableAtFps } from "./fpsGate";

// Blinks per minute over a rolling window. The denominator is the
// time actually observed, capped at the window, and no rate exists
// at all before the observation minimum, honest young windows.
export type BlinkRateState = {
  startedAtMs: number;
  blinkTimesMs: number[];
};

export function startRate(nowMs: number): BlinkRateState {
  return { startedAtMs: nowMs, blinkTimesMs: [] };
}

export function recordBlink(
  state: BlinkRateState,
  nowMs: number,
): BlinkRateState {
  // Backwards clock: ignored, state unchanged. The read side is
  // already safe, its minimum-observation rule refuses a negative
  // span, so this keeps the record ordered. Issue #107, C3.
  const newest = state.blinkTimesMs[state.blinkTimesMs.length - 1];
  if (nowMs < state.startedAtMs || (newest !== undefined && nowMs < newest)) {
    return state;
  }
  return {
    ...state,
    blinkTimesMs: keepRecent(
      [...state.blinkTimesMs, nowMs],
      nowMs,
      BLINK_RATE_WINDOW_MS,
    ),
  };
}

export function blinkRatePerMin(
  state: BlinkRateState,
  nowMs: number,
): number | null {
  const observedMs = Math.min(nowMs - state.startedAtMs, BLINK_RATE_WINDOW_MS);
  if (observedMs < BLINK_RATE_MIN_OBSERVATION_MS) {
    return null;
  }
  const recent = keepRecent(state.blinkTimesMs, nowMs, BLINK_RATE_WINDOW_MS);
  return (recent.length * 60000) / observedMs;
}

// The 4.6 gate composed with the rate: below the minimum frame rate
// the rate is null even when blinks are in the window. Null, not
// zero: zero would claim calm eyes on evidence that missed blinks.
export function gatedBlinkRatePerMin(
  fps: number | null,
  state: BlinkRateState,
  nowMs: number,
): number | null {
  if (!measurableAtFps(fps)) {
    return null;
  }
  return blinkRatePerMin(state, nowMs);
}
