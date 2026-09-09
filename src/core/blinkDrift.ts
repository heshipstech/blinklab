import type { BlinkEvent } from "./blinkLog";
import { mean } from "./statistics";

// Roadmap 12.14. Does a person's blinking change over the length of a
// sitting?
//
// THE OBVIOUS PLACE TO LOOK IS THE WRONG PLACE, and that is the whole
// row. The per-second buffer keeps FEATURE_RECORD_CAP rows, about an
// hour, and drops the oldest to stay bounded. Ask it when the session
// began and, in any sitting longer than that, it answers an hour ago.
// A drift computed from it would be a real number describing a session
// that did not happen: "since the beginning" would quietly mean "since
// the buffer wrapped", and the longer somebody sat the less of their
// sitting it would cover.
//
// The blink log is the record that outlives the wrap. One event per
// blink, each stamped with when it ended, bounded at thirty times the
// per-second cap, which is about twenty-seven hours at a resting rate.
// So the drift is read from the log, and the session start is PASSED
// IN rather than inferred from whatever is still in a buffer, because
// inferring it is exactly the mistake.
//
// A DEMONSTRATION. Nothing here has been validated against an outcome:
// this project has no data in which a person's blinking was watched
// over hours beside anything that says how they were doing. The label
// below travels with the number and says so, and it is a test rather
// than an intention.

/**
 * What this number may be called wherever a person can read it.
 *
 * It names the measurement and refuses the interpretation. Blink
 * parameters lengthening over a sitting is a thing this instrument can
 * see; that it means fatigue is a thing this project has never
 * measured, and 12.18 is the row that would earn the word.
 */
export const DRIFT_LABEL =
  "change over time on task, a demonstration: not validated against any outcome";

/**
 * How many blinks each half needs before a change between them is
 * reported at all.
 *
 * The same fifteen as the rhythm floor, and for the same reason rather
 * than for tidiness: below it a mean is decided by which particular
 * blinks happened to land in the window, and a difference between two
 * such means is that instability twice. Stated as a CHOICE. It is not
 * derived from anything, and no measurement placed it.
 */
export const MIN_BLINKS_PER_HALF = 15;

/** What one drift reading says. */
export type Drift = {
  earlyMean: number;
  lateMean: number;
  /** The change as a fraction of where it started. */
  changeFraction: number;
};

/**
 * How long into the session a blink happened.
 *
 * Throws on a blink stamped before the start. Returning a negative
 * elapsed would sort it into the early half and drag that half's mean,
 * and a blink from before the session began is a defect in whatever
 * assembled the log rather than a very early blink.
 */
export function timeOnTaskMs(
  event: BlinkEvent,
  sessionStartMs: number,
): number {
  if (event.atMs < sessionStartMs) {
    throw new Error(
      `blink at ${String(event.atMs)} is before the session start ` +
        `${String(sessionStartMs)}. A blink from before the beginning is a ` +
        "defect in the log, not a very early blink",
    );
  }
  return event.atMs - sessionStartMs;
}

/**
 * How much a blink parameter changed between the first and second
 * halves of a sitting, or null when there is not enough to say.
 *
 * `read` picks the parameter and may return null for a blink that
 * never carried one: a blink whose shape could not be analysed has no
 * amplitude, and counting it as zero would drag whichever half it fell
 * in toward a change nobody made.
 *
 * THE SPLIT IS BY TIME, not by how many blinks fell where. Half the
 * blinks is not half the sitting: somebody who blinks hard for ten
 * minutes and then settles would have the boundary drawn inside those
 * ten minutes, and the reading would be most of hour one against
 * itself.
 *
 * The change is a FRACTION of where it started, for the reason the
 * rhythm row chose a ratio: 100 ms means something different to a
 * 200 ms blink and a 600 ms one, so an absolute difference would
 * smuggle blink length into a measure of change. Null when the early
 * mean is at or below zero, where the fraction is meaningless.
 */
export function parameterDrift(
  events: readonly BlinkEvent[],
  sessionStartMs: number,
  read: (event: BlinkEvent) => number | null,
): Drift | null {
  const timed = events.map((event) => ({
    elapsedMs: timeOnTaskMs(event, sessionStartMs),
    value: read(event),
  }));
  if (timed.length === 0) {
    return null;
  }
  const last = timed.reduce(
    (longest, one) => Math.max(longest, one.elapsedMs),
    0,
  );
  const midpointMs = last / 2;
  const valuesIn = (early: boolean): number[] =>
    timed
      .filter((one) => one.elapsedMs < midpointMs === early)
      .map((one) => one.value)
      .filter((value): value is number => value !== null);

  const earlyValues = valuesIn(true);
  const lateValues = valuesIn(false);
  if (
    earlyValues.length < MIN_BLINKS_PER_HALF ||
    lateValues.length < MIN_BLINKS_PER_HALF
  ) {
    return null;
  }
  const earlyMean = mean(earlyValues);
  const lateMean = mean(lateValues);
  if (earlyMean === null || lateMean === null || earlyMean <= 0) {
    return null;
  }
  return {
    earlyMean,
    lateMean,
    changeFraction: lateMean / earlyMean - 1,
  };
}
