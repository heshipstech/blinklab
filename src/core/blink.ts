// The first blink detector, deliberately naive: one fixed threshold
// on the millimetre aperture. Below it the eye counts as closed, and
// a completed close and reopen counts one blink. Its two known
// blindnesses are scheduled: personal baselines at 4.2, squint
// separation at 4.7.
export type BlinkState = {
  eye: "open" | "closed" | "unknown";
  blinkCount: number;
};

export const initialBlinkState: BlinkState = {
  eye: "unknown",
  blinkCount: 0,
};

export function blinkStep(
  state: BlinkState,
  apertureMm: number | null,
  thresholdMm: number,
): BlinkState {
  // An invalid frame breaks the cycle: a blink we could not watch
  // from start to finish is not a blink we may count.
  if (apertureMm === null) {
    return { ...state, eye: "unknown" };
  }
  if (apertureMm < thresholdMm) {
    return { ...state, eye: "closed" };
  }
  const completedBlink = state.eye === "closed";
  return {
    eye: "open",
    blinkCount: state.blinkCount + (completedBlink ? 1 : 0),
  };
}
