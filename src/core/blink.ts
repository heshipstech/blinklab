import { MAX_BLINK_DURATION_MS } from "./constants";

// The blink detector. Below the threshold counts as closed, and a
// completed close and reopen counts one blink IF the closure was
// brief enough to be one: beyond MAX_BLINK_DURATION_MS the eye was
// not blinking, it was held closed or squinted shut, a different
// phenomenon that counts nothing here (6.2 detects it separately).
export type BlinkState = {
  eye: "open" | "closed" | "unknown";
  blinkCount: number;
  // When the current closure began, meaningful only while closed.
  closedAtMs: number | null;
  // The closed phase length of the most recent completed blink.
  lastBlinkDurationMs: number | null;
};

export const initialBlinkState: BlinkState = {
  eye: "unknown",
  blinkCount: 0,
  closedAtMs: null,
  lastBlinkDurationMs: null,
};

export function blinkStep(
  state: BlinkState,
  nowMs: number,
  apertureMm: number | null,
  thresholdMm: number,
): BlinkState {
  // An invalid frame breaks the cycle: a blink we could not watch
  // from start to finish is not a blink we may count or time.
  if (apertureMm === null) {
    return { ...state, eye: "unknown", closedAtMs: null };
  }
  if (apertureMm < thresholdMm) {
    return {
      ...state,
      eye: "closed",
      closedAtMs: state.eye === "closed" ? state.closedAtMs : nowMs,
    };
  }
  const closedDurationMs =
    state.eye === "closed" && state.closedAtMs !== null
      ? nowMs - state.closedAtMs
      : null;
  const completedBlink =
    closedDurationMs !== null && closedDurationMs <= MAX_BLINK_DURATION_MS;
  return {
    eye: "open",
    blinkCount: state.blinkCount + (completedBlink ? 1 : 0),
    closedAtMs: null,
    lastBlinkDurationMs:
      completedBlink && closedDurationMs !== null
        ? closedDurationMs
        : state.lastBlinkDurationMs,
  };
}
