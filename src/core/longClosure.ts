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
// The line is the blink maximum itself, aliased not copied: at or
// below it a closure is a blink (blink.ts counts it), strictly
// beyond it a long closure (this counts it). Every closure lands in
// exactly one category, and no drifting constant can break that.
export const LONG_CLOSURE_THRESHOLD_MS = MAX_BLINK_DURATION_MS;

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
  return nowMs - state.closedAtMs;
}
