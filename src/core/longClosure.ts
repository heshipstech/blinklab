import {
  APERTURE_HYSTERESIS_FRACTION,
  MAX_BLINK_DURATION_MS,
} from "./constants";

// The long closure detector, the event 4.7 promised. A closure that
// outstays a blink is a different phenomenon: not a flick of the
// eyelid but eyes staying shut, the microsleep shape the drowsiness
// literature watches for. It fires WHILE the eyes are still closed,
// the moment a closed frame crosses the line, because an event only
// reported after it ends is useless to an alert (6.3's business).
// One exception keeps the partition airtight: a closure that crosses
// the line between its last closed frame and the reopen frame fires
// late, on the reopen, using the same reopen-measured span blink.ts
// uses to refuse it.
//
// The TIME line is the blink maximum itself, aliased not copied: at
// or below it a closure is a blink (blink.ts counts it), strictly
// beyond it a long closure (this counts it). For any one aperture
// line, every closure lands in exactly one time category, and no
// drifting constant can break that.
export const LONG_CLOSURE_THRESHOLD_MS = MAX_BLINK_DURATION_MS;

// The APERTURE line, roadmap amendment 5: eyes SHUT is not lids low.
// The blink detector keeps its half-of-baseline line, because a
// blink is a rapid partial descent. But this detector asks whether
// the eyes are actually shut, and a real face proved the two lines
// must differ: naturally low eyelids reading at the bottom of a
// screen sat below the blink line for five seconds while fully
// awake. The literature's P80 convention (20 percent of baseline)
// assumes an instrument that reads shut eyes as nearly zero; this
// instrument has a measured floor, fully shut eyes still report
// about a third of baseline. So the shut line sits at 40 percent:
// the measured midpoint between the owner's shut floor (about 33
// percent) and their relaxed reading droop (45 to 50 percent). The
// band between the blink line and this line is a partial droop,
// deliberately neither a blink nor a long closure.
export const EYES_SHUT_FRACTION = 0.4;

export function longClosureThresholdMm(baselineMm: number): number {
  return EYES_SHUT_FRACTION * baselineMm;
}

// Roadmap 10.11, briefs A7 and A19, prediction committed first in
// docs/long-closure-hysteresis.txt. Two rules join the state machine,
// both blink.ts's own patterns aliased rather than copied, and both
// HYSTERESIS rather than filtering: no aperture sample is altered or
// discarded, the rules only decide whether a crossing ARMS an event.
//
// The re-arm gate: an eyelid hovering AT the shut line crosses it
// with every wobble of noise, and each crossing used to mint another
// countable closure — the dry run's iPhone rows sat in a 2.79 to
// 3.01 mm band against a 3.04 mm line and one sustained droop
// counted three times. Now a closure fires only while the gate is
// open, the gate closes on a fire, and it reopens only when the eye
// is seen CLEARLY open: above the line by the same noise-floor-
// derived fraction blink.ts arms with.
export const LONG_CLOSURE_REARM_FRACTION = APERTURE_HYSTERESIS_FRACTION;

// The bounded gap: a single untrusted frame used to abandon the whole
// cycle, so a one-frame face flicker split a six-second closure in
// two. Closure state now survives an untrusted run up to this bound,
// aliased to the blink maximum: a gap long enough to hide a complete
// blink-sized reopen is long enough to hide the closure's end, so
// beyond it the cycle is honestly abandoned — and abandoned with the
// gate CLOSED, because closed frames after a long gap may be a droop
// that never ended, and firing there would count it twice.
export const LONG_CLOSURE_MAX_GAP_MS = MAX_BLINK_DURATION_MS;

export type LongClosureState = {
  eye: "open" | "closed" | "unknown";
  // When the current closure began. Kept across a bounded untrusted
  // run, so it is meaningful while closed AND during such a run.
  closedAtMs: number | null;
  // True once the current closure has fired its event: one closure,
  // one count, however long it holds.
  firedForCurrentClosure: boolean;
  count: number;
  // The full closed span of the most recent completed long closure.
  lastLongClosureDurationMs: number | null;
  // Whether the eye has been seen clearly open — above the shut line
  // by LONG_CLOSURE_REARM_FRACTION — since the last fired closure or
  // the last over-bound untrusted run. True at the start: the first
  // closure needs no prior reopening evidence, blink.ts's own rule.
  rearmed: boolean;
  // When the current untrusted run began, or null outside one.
  unknownSinceMs: number | null;
};

export const initialLongClosureState: LongClosureState = {
  eye: "unknown",
  closedAtMs: null,
  firedForCurrentClosure: false,
  count: 0,
  lastLongClosureDurationMs: null,
  rearmed: true,
  unknownSinceMs: null,
};

export function longClosureStep(
  state: LongClosureState,
  nowMs: number,
  apertureMm: number | null,
  thresholdMm: number,
): LongClosureState {
  // Backwards clock: ignored, state unchanged. Same contract as
  // blink.ts, same reason: a reopen stamped earlier than the close
  // measured a negative closure. Issue #107, remediation C3.
  if (
    nowMs < (state.closedAtMs ?? nowMs) ||
    nowMs < (state.unknownSinceMs ?? nowMs)
  ) {
    return state;
  }
  // An untrusted frame no longer abandons the cycle outright: the
  // closure survives a run of them up to LONG_CLOSURE_MAX_GAP_MS,
  // because eyes shut before a sub-blink-length gap and shut after
  // it did not plausibly open in between. Past the bound the cycle
  // is abandoned — the closure's end is lost, so no duration — and
  // the re-arm gate closes with it: what follows may be the same
  // droop still going, and firing there would count it twice.
  if (apertureMm === null) {
    const unknownSinceMs = state.unknownSinceMs ?? nowMs;
    if (nowMs - unknownSinceMs > LONG_CLOSURE_MAX_GAP_MS) {
      return {
        ...state,
        eye: "unknown",
        closedAtMs: null,
        firedForCurrentClosure: false,
        rearmed: false,
        unknownSinceMs,
      };
    }
    return { ...state, eye: "unknown", unknownSinceMs };
  }
  // A trusted frame after an untrusted run: the run's length decides
  // whether the cycle survived it. Measured from the run's first
  // frame, which understates the unwitnessed span by at most one
  // frame interval — on the honest side, since a shorter measured
  // gap only ever KEEPS a closure the truth might have ended.
  const gapOverBound =
    state.unknownSinceMs !== null &&
    nowMs - state.unknownSinceMs > LONG_CLOSURE_MAX_GAP_MS;
  const survivedClosedAtMs = gapOverBound ? null : state.closedAtMs;
  const fired = gapOverBound ? false : state.firedForCurrentClosure;
  const rearmed = gapOverBound ? false : state.rearmed;
  if (apertureMm < thresholdMm) {
    const closedAtMs = survivedClosedAtMs ?? nowMs;
    const fires =
      rearmed && !fired && nowMs - closedAtMs > LONG_CLOSURE_THRESHOLD_MS;
    return {
      ...state,
      eye: "closed",
      closedAtMs,
      firedForCurrentClosure: fired || fires,
      count: state.count + (fires ? 1 : 0),
      // The gate closes the moment a closure fires: the next event
      // needs the eye seen clearly open first.
      rearmed: fires ? false : rearmed,
      unknownSinceMs: null,
    };
  }
  const closedDurationMs =
    survivedClosedAtMs !== null ? nowMs - survivedClosedAtMs : null;
  // A closure can cross the line BETWEEN its last closed frame and
  // the reopen frame. blink.ts measures the span to the reopen and
  // refuses anything beyond the maximum, so the same reopen-measured
  // span must fire here too, late, or a witnessed closure just past
  // the line would land in neither bin and the partition would leak.
  const lateFire =
    rearmed &&
    !fired &&
    closedDurationMs !== null &&
    closedDurationMs > LONG_CLOSURE_THRESHOLD_MS;
  const completedLong = (fired && closedDurationMs !== null) || lateFire;
  // The gate reopens only on an eye seen CLEARLY open — the line
  // cleared by the re-arm fraction — and a reopen that overshoots
  // straight past that height on the firing frame has proven the
  // reopening already, blink.ts's own boundary rule.
  const clearlyOpen =
    apertureMm >= thresholdMm * (1 + LONG_CLOSURE_REARM_FRACTION);
  return {
    ...state,
    eye: "open",
    closedAtMs: null,
    firedForCurrentClosure: false,
    count: state.count + (lateFire ? 1 : 0),
    lastLongClosureDurationMs:
      completedLong && closedDurationMs !== null
        ? closedDurationMs
        : state.lastLongClosureDurationMs,
    rearmed: (lateFire ? false : rearmed) || clearlyOpen,
    unknownSinceMs: null,
  };
}

// The live readout: how long the eyes have been shut, spoken only
// during a long closure in progress. Silent while open and silent
// during blink sized closures, so the line never flickers on every
// blink.
export function ongoingClosureMs(
  state: LongClosureState,
  nowMs: number,
): number | null {
  if (
    state.eye !== "closed" ||
    !state.firedForCurrentClosure ||
    state.closedAtMs === null
  ) {
    return null;
  }
  // A read clock behind the closure start has no honest answer, and
  // "0 ms and counting" would be a wrong one. Issue #107 named this
  // function; null, never a negative. Remediation C3.
  if (nowMs < state.closedAtMs) {
    return null;
  }
  return nowMs - state.closedAtMs;
}
