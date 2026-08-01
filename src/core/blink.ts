// The blink detector, now with time. Below the threshold counts as
// closed, a completed close and reopen counts one blink and reports
// how long the eye stayed below, the closed phase duration. Its two
// known blindnesses are scheduled: personal baselines arrived at 4.2,
// squint separation comes at 4.7.
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
  const completedBlink = state.eye === "closed" && state.closedAtMs !== null;
  return {
    eye: "open",
    blinkCount: state.blinkCount + (completedBlink ? 1 : 0),
    closedAtMs: null,
    lastBlinkDurationMs:
      completedBlink && state.closedAtMs !== null
        ? nowMs - state.closedAtMs
        : state.lastBlinkDurationMs,
  };
}
