import { MAX_BLINK_DURATION_MS } from "./constants";

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

export type LongClosureState = {
  eye: "open" | "closed" | "unknown";
  // When the current closure began, meaningful only while closed.
  closedAtMs: number | null;
  // True once the current closure has fired its event: one closure,
  // one count, however long it holds.
  firedForCurrentClosure: boolean;
  count: number;
  // The full closed span of the most recent completed long closure.
  lastLongClosureDurationMs: number | null;
};

export const initialLongClosureState: LongClosureState = {
  eye: "unknown",
  closedAtMs: null,
  firedForCurrentClosure: false,
  count: 0,
  lastLongClosureDurationMs: null,
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
  if (state.closedAtMs !== null && nowMs < state.closedAtMs) {
    return state;
  }
  // An invalid frame abandons the cycle, blink.ts's own rule: no
  // event may be built on frames nobody saw. A count that already
  // fired stays fired, that moment WAS witnessed, but the closure's
  // end is lost, so no duration gets recorded.
  if (apertureMm === null) {
    return {
      ...state,
      eye: "unknown",
      closedAtMs: null,
      firedForCurrentClosure: false,
    };
  }
  if (apertureMm < thresholdMm) {
    const closedAtMs =
      state.eye === "closed" && state.closedAtMs !== null
        ? state.closedAtMs
        : nowMs;
    const fires =
      !state.firedForCurrentClosure &&
      nowMs - closedAtMs > LONG_CLOSURE_THRESHOLD_MS;
    return {
      ...state,
      eye: "closed",
      closedAtMs,
      firedForCurrentClosure: state.firedForCurrentClosure || fires,
      count: state.count + (fires ? 1 : 0),
    };
  }
  const closedDurationMs =
    state.eye === "closed" && state.closedAtMs !== null
      ? nowMs - state.closedAtMs
      : null;
  // A closure can cross the line BETWEEN its last closed frame and
  // the reopen frame. blink.ts measures the span to the reopen and
  // refuses anything beyond the maximum, so the same reopen-measured
  // span must fire here too, late, or a witnessed closure just past
  // the line would land in neither bin and the partition would leak.
  const lateFire =
    !state.firedForCurrentClosure &&
    closedDurationMs !== null &&
    closedDurationMs > LONG_CLOSURE_THRESHOLD_MS;
  const completedLong =
    (state.firedForCurrentClosure && closedDurationMs !== null) || lateFire;
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
