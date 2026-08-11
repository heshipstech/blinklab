import {
  APERTURE_HYSTERESIS_FRACTION,
  BLINK_REFRACTORY_MS,
  MAX_BLINK_DURATION_MS,
} from "./constants";

// The blink detector. Below the threshold counts as closed, and a
// completed close and reopen counts one blink IF the closure was
// brief enough to be one: beyond MAX_BLINK_DURATION_MS the eye was
// not blinking, it was held closed or squinted shut, a different
// phenomenon that counts nothing here (6.2 detects it separately).
//
// Since fix #114 a closure must also prove its DEPTH: it only arms
// as a blink candidate once the aperture reaches the threshold minus
// the shared hysteresis gap. Noise riding the line dips a tenth of a
// millimetre and never arms, so it can no longer mint phantom
// blinks, while a real blink plunges far past the arm line. Closing
// and reopening are unchanged, both at the same threshold, so every
// duration keeps its 4.3 definition. The first fix #114 design moved
// the REOPEN line instead, and adversarial review killed it three
// ways: band time corrupted durations, the latch had no time bound,
// and chatter could swallow real blinks. Depth arming has none of
// those failure modes, because it never changes when a closure ends.
export type BlinkState = {
  eye: "open" | "closed" | "unknown";
  blinkCount: number;
  // When the current closure began, meaningful only while closed.
  closedAtMs: number | null;
  // Whether the current closure has reached blink depth.
  armed: boolean;
  // The closed phase length of the most recent completed blink.
  lastBlinkDurationMs: number | null;
  // When the most recent COUNTED blink ended. A closure finishing
  // within BLINK_REFRACTORY_MS of this is the tail of that blink
  // rather than a new one, and is not counted again. See #176.
  lastBlinkEndedAtMs: number | null;
};

export const initialBlinkState: BlinkState = {
  eye: "unknown",
  blinkCount: 0,
  closedAtMs: null,
  armed: false,
  lastBlinkDurationMs: null,
  lastBlinkEndedAtMs: null,
};

export function blinkStep(
  state: BlinkState,
  nowMs: number,
  apertureMm: number | null,
  thresholdMm: number,
): BlinkState {
  // A frame stamped earlier than the newest timestamp this state
  // CARRIES is ignored, state unchanged: without this, a reopen
  // stamped earlier than the close recorded a negative duration. An
  // open state carries no timestamp, so a backwards frame there is
  // still accepted; full monotonicity lives at the door, in
  // frameClock's acceptFrame, which the real wiring always crosses.
  // Issue #107, remediation C3.
  if (
    nowMs < (state.closedAtMs ?? nowMs) ||
    nowMs < (state.lastBlinkEndedAtMs ?? nowMs)
  ) {
    return state;
  }
  // An invalid frame breaks the cycle: a blink we could not watch
  // from start to finish is not a blink we may count or time.
  if (apertureMm === null) {
    return { ...state, eye: "unknown", closedAtMs: null, armed: false };
  }
  if (apertureMm < thresholdMm) {
    // Exactly at the arm line still arms, the house boundary rule.
    const reachedDepth =
      apertureMm <= thresholdMm * (1 - APERTURE_HYSTERESIS_FRACTION);
    return {
      ...state,
      eye: "closed",
      closedAtMs: state.eye === "closed" ? state.closedAtMs : nowMs,
      armed: (state.eye === "closed" && state.armed) || reachedDepth,
    };
  }
  const closedDurationMs =
    state.eye === "closed" && state.closedAtMs !== null
      ? nowMs - state.closedAtMs
      : null;
  const shapedLikeABlink =
    closedDurationMs !== null &&
    closedDurationMs <= MAX_BLINK_DURATION_MS &&
    state.armed;
  // The refractory period. An eyelid cannot open and shut twice this
  // fast, so a closure finishing this soon after the last counted
  // blink is the same blink reported twice. It is dropped rather than
  // counted, and it does not refresh the timer, so a burst of chatter
  // cannot walk the window forward and swallow a genuine later blink.
  const withinRefractory =
    state.lastBlinkEndedAtMs !== null &&
    nowMs - state.lastBlinkEndedAtMs < BLINK_REFRACTORY_MS;
  const completedBlink = shapedLikeABlink && !withinRefractory;
  return {
    eye: "open",
    blinkCount: state.blinkCount + (completedBlink ? 1 : 0),
    closedAtMs: null,
    armed: false,
    lastBlinkDurationMs:
      completedBlink && closedDurationMs !== null
        ? closedDurationMs
        : state.lastBlinkDurationMs,
    lastBlinkEndedAtMs: completedBlink ? nowMs : state.lastBlinkEndedAtMs,
  };
}
