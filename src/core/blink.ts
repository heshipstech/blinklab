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
//
// Since 20 August 2026 a closure must also prove the eye REOPENED:
// after a counted blink, no new closure may arm until the aperture
// has risen the same hysteresis gap ABOVE the threshold. The
// validation round's P1 showed why: a slow, deep blinker's lid
// hovers near the line while reopening, wobbles past the arm line
// 200 to 270 ms after the counted blink, outside the refractory
// period's reach, and one blink minted 25 counts for 10. The gate
// moves neither the closing nor the reopening line, so durations
// stay untouched, which is what separates it from the killed latch.
// Its cost, accepted in docs/blink-rearm.txt before the experiment:
// a lid that hovers inside the 10 percent band above the line has
// its next blinks suppressed until it rises out, and that band is a
// nearly-shut eye where a blink count is already dubious.
export type BlinkState = {
  eye: "open" | "closed" | "unknown";
  blinkCount: number;
  // When the current closure began, meaningful only while closed.
  closedAtMs: number | null;
  // Whether the current closure has reached blink depth.
  armed: boolean;
  // Whether the eye has risen above the re-arm line since the last
  // COUNTED blink. True at the start: the first blink needs no prior
  // reopening evidence.
  rearmed: boolean;
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
  rearmed: true,
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
    // Arming also requires the re-arm gate: depth alone is not
    // enough when the eye never reopened after the last count.
    const reachedDepth =
      apertureMm <= thresholdMm * (1 - APERTURE_HYSTERESIS_FRACTION);
    return {
      ...state,
      eye: "closed",
      closedAtMs: state.eye === "closed" ? state.closedAtMs : nowMs,
      armed:
        (state.eye === "closed" && state.armed) ||
        (reachedDepth && state.rearmed),
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
  // The re-arm gate closes on a counted blink and opens again the
  // moment the aperture clears the line by the hysteresis gap. Both
  // can happen on the same frame: a reopen that overshoots straight
  // past the re-arm line has proven the reopening already.
  const rearmed =
    (completedBlink ? false : state.rearmed) ||
    apertureMm >= thresholdMm * (1 + APERTURE_HYSTERESIS_FRACTION);
  return {
    eye: "open",
    blinkCount: state.blinkCount + (completedBlink ? 1 : 0),
    closedAtMs: null,
    armed: false,
    rearmed,
    lastBlinkDurationMs:
      completedBlink && closedDurationMs !== null
        ? closedDurationMs
        : state.lastBlinkDurationMs,
    lastBlinkEndedAtMs: completedBlink ? nowMs : state.lastBlinkEndedAtMs,
  };
}
