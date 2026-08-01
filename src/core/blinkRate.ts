import {
  BLINK_RATE_MIN_OBSERVATION_MS,
  BLINK_RATE_WINDOW_MS,
} from "./constants";
import { keepRecent } from "./fps";

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
