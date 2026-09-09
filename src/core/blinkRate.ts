import type { BlinkState } from "./blink";
import {
  BLINK_RATE_MIN_OBSERVATION_MS,
  BLINK_RATE_WINDOW_MS,
  MAX_BLINK_DURATION_MS,
  MIN_BLINK_FPS,
} from "./constants";
import { keepRecent } from "./fps";
import { measurableAtFps } from "./fpsGate";

// Blinks per minute over a rolling window — of OBSERVED time, not
// wall time. Roadmap 10.12b: the denominator used to be the clock,
// so a face-loss gap diluted the count and read as calm, which is
// the one thing a gap must never read as. The denominator is now the
// time the detector was actually fed an aperture, kept as frame
// timestamps and windowed exactly like the blink times, and no rate
// exists before the observation minimum of FED time.
export type BlinkRateState = {
  startedAtMs: number;
  blinkTimesMs: number[];
  // Timestamps of frames that were fed an aperture. A frame the
  // detector never saw is a frame that observed nothing.
  fedFrameTimesMs: number[];
};

// The most observation one frame can vouch for: one frame interval
// at the slowest rate the gate lets measure. Derived from
// MIN_BLINK_FPS rather than chosen, so a gap between fed frames
// wider than the slowest legal interval credits only that interval —
// the rest of the gap was not watched.
const FRAME_CREDIT_MS = 1000 / MIN_BLINK_FPS;

export function startRate(nowMs: number): BlinkRateState {
  return { startedAtMs: nowMs, blinkTimesMs: [], fedFrameTimesMs: [] };
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

/**
 * One frame's worth of observation, recorded only when the frame was
 * actually fed an aperture. Same backwards-clock refusal as
 * `recordBlink`, same window, same pruning.
 */
export function observeFrame(
  state: BlinkRateState,
  nowMs: number,
  fedAperture: boolean,
): BlinkRateState {
  if (!fedAperture) {
    return state;
  }
  const newest = state.fedFrameTimesMs[state.fedFrameTimesMs.length - 1];
  if (nowMs < state.startedAtMs || (newest !== undefined && nowMs < newest)) {
    return state;
  }
  return {
    ...state,
    fedFrameTimesMs: keepRecent(
      [...state.fedFrameTimesMs, nowMs],
      nowMs,
      BLINK_RATE_WINDOW_MS,
    ),
  };
}

/**
 * The observed time inside the window: the gaps between consecutive
 * fed frames, each credited at most one slowest-legal frame
 * interval. A lone frame observes nothing between frames, so it
 * credits nothing — which also means the pruning at the window edge
 * can only UNDERCOUNT by less than one interval, an error on the
 * honest side (a smaller denominator reads as a busier eye, never a
 * calmer one).
 */
function observedMsInWindow(state: BlinkRateState, nowMs: number): number {
  const kept = keepRecent(state.fedFrameTimesMs, nowMs, BLINK_RATE_WINDOW_MS);
  let observed = 0;
  let previous: number | null = null;
  for (const stamp of kept) {
    if (previous !== null) {
      observed += Math.min(stamp - previous, FRAME_CREDIT_MS);
    }
    previous = stamp;
  }
  return observed;
}

export function blinkRatePerMin(
  state: BlinkRateState,
  nowMs: number,
): number | null {
  const observedMs = observedMsInWindow(state, nowMs);
  if (observedMs < BLINK_RATE_MIN_OBSERVATION_MS) {
    return null;
  }
  const recent = keepRecent(state.blinkTimesMs, nowMs, BLINK_RATE_WINDOW_MS);
  return (recent.length * 60000) / observedMs;
}

/**
 * How much of the rolling window was actually observed, 0 to 1.
 * Exported beside the rate so a reader can weigh it: a rate over a
 * third of the window is a different fact from the same rate over
 * all of it. Null before any wall time has passed, clamped at one
 * because the per-frame credit can round a continuous feed a hair
 * past the span it sits in.
 */
export function observedFraction(
  state: BlinkRateState,
  nowMs: number,
): number | null {
  const spanMs = Math.min(nowMs - state.startedAtMs, BLINK_RATE_WINDOW_MS);
  if (spanMs <= 0) {
    return null;
  }
  return Math.min(1, observedMsInWindow(state, nowMs) / spanMs);
}

/**
 * Whether blink counting is suspended this frame, as a fact read
 * from the reducer's own public state rather than re-derived: the
 * eye has been closed past the longest thing the detector will call
 * a blink, or the re-arm gate is down because the eye never rose
 * clearly above the line after the last counted blink. Either way a
 * blink happening now would not be counted, and a rate published
 * over such a stretch would be a number about a detector that was
 * not listening.
 */
export function countingSuspended(blink: BlinkState, nowMs: number): boolean {
  const closedTooLong =
    blink.eye === "closed" &&
    blink.closedAtMs !== null &&
    nowMs - blink.closedAtMs > MAX_BLINK_DURATION_MS;
  return closedTooLong || !blink.rearmed;
}

/**
 * When the current suspension began, for the page to say how long:
 * the start of the over-long closure, or the counted blink that
 * closed the re-arm gate. Null when counting is live.
 */
export function suspendedSinceMs(
  blink: BlinkState,
  nowMs: number,
): number | null {
  if (!countingSuspended(blink, nowMs)) {
    return null;
  }
  if (!blink.rearmed && blink.lastBlinkEndedAtMs !== null) {
    return blink.lastBlinkEndedAtMs;
  }
  return blink.closedAtMs;
}

/** The row's own words, for the page. Roadmap 10.12b. */
export function suspendedSentence(seconds: number): string {
  return `Blink counting suspended for ${String(seconds)} s`;
}

// The 4.6 gate composed with the rate, and now with the suspension:
// below the minimum frame rate the rate is null even when blinks are
// in the window, and while counting is suspended it is null even at
// a healthy rate. Null, not zero: zero would claim calm eyes on
// evidence that missed blinks.
export function gatedBlinkRatePerMin(
  fps: number | null,
  state: BlinkRateState,
  blink: BlinkState,
  nowMs: number,
): number | null {
  if (!measurableAtFps(fps) || countingSuspended(blink, nowMs)) {
    return null;
  }
  return blinkRatePerMin(state, nowMs);
}
