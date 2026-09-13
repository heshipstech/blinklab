// The frames the instrument was too busy to look at, counted from the
// compositor's own tally.
//
// The live camera path draws on requestVideoFrameCallback, which is
// meant to fire once per frame the browser PRESENTS. When the main
// thread is busy, though, the browser coalesces: it presents several
// frames while the callback runs and fires the callback once when the
// thread frees, and metadata.presentedFrames still counts every frame
// it presented in between. So the gap between how far presentedFrames
// advanced and how many callbacks actually fired is the number of
// photographs the instrument never got to look at because it was busy.
//
// This is a different loss from the one src/core/deliveryRate.ts
// measures. That module compares the frames the DETECTOR read against
// the frames the OBSERVER saw arrive; but when the thread is busy enough
// that the delivery callback itself coalesces, the observer under-counts
// arrivals too, and the read fraction cannot see it. presentedFrames
// can, because it is the compositor's count, not the callback's.
//
// Pure, as everything that decides anything here is. Reading
// metadata.presentedFrames off a video element is io/frameLoop.ts's job.

export type FramesMissedState =
  | {
      readonly kind: "counting";
      /**
       * The presentedFrames of the last callback, or null before the
       * first. The first value seen is only a BASELINE: presentedFrames
       * is cumulative since the element began producing frames, so a
       * loop that attaches late sees a large first value that is not a
       * loss it is responsible for.
       */
      readonly lastPresented: number | null;
      /** How many callbacks have fired (frames actually looked at). */
      readonly observed: number;
      /** Presented frames skipped between callbacks, summed. */
      readonly missed: number;
    }
  | {
      readonly kind: "refused";
      /** Why the count is untrustworthy, named rather than hidden. */
      readonly reason: string;
    };

export function emptyFramesMissed(): FramesMissedState {
  return { kind: "counting", lastPresented: null, observed: 0, missed: 0 };
}

/**
 * One frame callback fired, carrying its metadata.presentedFrames.
 *
 * presentedFrames must be a non-negative integer that strictly advances
 * from one callback to the next: it is a running count. A repeat, a
 * backwards step, or a value that is not a whole count is a browser (or
 * a fake) breaking that contract, and the whole measurement is REFUSED
 * by name rather than folded in as a gap of zero or a negative miss. A
 * refusal is final, the same way a refused calibration stays refused: a
 * later well-formed frame does not un-refuse a session that already saw
 * a bad one.
 */
export function notePresented(
  state: FramesMissedState,
  presented: number,
): FramesMissedState {
  if (state.kind === "refused") {
    return state;
  }
  if (!Number.isInteger(presented) || presented < 0) {
    return {
      kind: "refused",
      reason: `presentedFrames was not a whole count: ${String(presented)}`,
    };
  }
  if (state.lastPresented === null) {
    return {
      kind: "counting",
      lastPresented: presented,
      observed: 1,
      missed: 0,
    };
  }
  const gap = presented - state.lastPresented;
  if (gap <= 0) {
    return {
      kind: "refused",
      reason:
        `presentedFrames did not advance: ${String(presented)} ` +
        `after ${String(state.lastPresented)}`,
    };
  }
  return {
    kind: "counting",
    lastPresented: presented,
    observed: state.observed + 1,
    // A gap of one is a frame seen with none skipped; a gap of g skipped
    // g - 1. Never negative, because gap <= 0 is refused above.
    missed: state.missed + (gap - 1),
  };
}

export type FramesMissedSummary = {
  /**
   * Presented frames skipped while the thread was busy, or null when
   * nothing was observed or the count was refused. Null is "not known",
   * which is a different claim from a measured zero.
   */
  missedWhileBusy: number | null;
  /**
   * Frames the compositor presented over the observed span (the frames
   * looked at plus the frames missed), or null when unmeasurable.
   */
  framesPresented: number | null;
};

export function framesMissedSummary(
  state: FramesMissedState,
): FramesMissedSummary {
  if (state.kind === "refused" || state.observed === 0) {
    return { missedWhileBusy: null, framesPresented: null };
  }
  return {
    missedWhileBusy: state.missed,
    framesPresented: state.observed + state.missed,
  };
}
