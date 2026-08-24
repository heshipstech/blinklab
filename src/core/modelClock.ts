// One ratchet for every timestamp the face model is handed.
//
// Issue #221: MediaPipe demands a strictly increasing clock, and the
// page has three clocks to offer it — the wall clock for a camera,
// the wall clock again for a watched clip, a media clock for a
// stepped clip. Only the stepped path lifted its clock above what
// had already been sent, so a clip stepped faster than real time
// left the model's clock in the future, and the next camera or
// watched-clip frame handed it a smaller number. The model throws,
// the throw kills the display loop before it re-arms, and the page
// freezes silently.
//
// The rule, from the issue: on ANY source start, lift that source's
// clock above everything already sent — the same trick the stepped
// path used, made symmetric. The one thing the lift must never touch
// is the GAP between two stamps of one source: the model reads gaps
// to track a face between frames, and feeding it anything but source
// time is the repeatability defect of issue #174. So the lift is one
// constant per source, chosen on that source's first frame, and zero
// whenever no lift is needed — a camera on a fresh page hands the
// model the same wall clock it always has.

export type ModelClock = {
  /** The highest stamp ever handed to the model, null before the first. */
  readonly lastSentMs: number | null;
  /** The constant added to the current source's clock. */
  readonly offsetMs: number;
  /** Set at source start; the next stamp chooses the offset. */
  readonly pendingRebase: boolean;
};

export const initialModelClock: ModelClock = {
  lastSentMs: null,
  offsetMs: 0,
  pendingRebase: true,
};

/** A source is starting: its first frame picks a fresh offset. */
export function rebaseOnNextStamp(state: ModelClock): ModelClock {
  return { ...state, pendingRebase: true };
}

/**
 * The stamp for one frame, or null for a frame the model must not
 * see. Null happens only for a backwards clock INSIDE a source,
 * which frameClock's acceptFrame already guards at the door;
 * repairing it here instead would fake a gap the source never had.
 */
export function stampModelClock(
  state: ModelClock,
  sourceClockMs: number,
): { state: ModelClock; modelClockMs: number | null } {
  const offsetMs = state.pendingRebase
    ? state.lastSentMs === null
      ? 0
      : Math.max(0, state.lastSentMs + 1 - sourceClockMs)
    : state.offsetMs;
  const modelClockMs = sourceClockMs + offsetMs;
  if (state.lastSentMs !== null && modelClockMs <= state.lastSentMs) {
    return { state, modelClockMs: null };
  }
  return {
    state: { lastSentMs: modelClockMs, offsetMs, pendingRebase: false },
    modelClockMs,
  };
}
