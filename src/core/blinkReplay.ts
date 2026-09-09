import { blinkStep, initialBlinkState, type BlinkState } from "./blink";
import { APERTURE_HYSTERESIS_FRACTION } from "./constants";

// Roadmap 10.8a. Drive the REAL detector over a clip's committed
// per-frame trace, and keep the state it was in at every frame.
//
// The regression run wants this committed BEFORE it runs, and that
// order is the point: a tool written after seeing which blinks were
// missed is a tool shaped by them.
//
// WHY IT IS NOT THE MISS AUTOPSY. `analysis/tools/miss_autopsy.py`
// already asks what the aperture DID during a missed blink, and one of
// its four verdicts is `crossed_line` — in its own words, "the
// aperture signal was there and the detector's own state machine
// (re-arm, refractory) swallowed it". That verdict names two
// mechanisms and cannot tell them apart, because it reads the trace
// and not the detector. The re-arm gate and the refractory window have
// different causes and different fixes, so a run reporting "the state
// machine did it" on forty misses tells nobody which one to open.
//
// WHY TYPESCRIPT AND NOT PYTHON, where the rest of the analysis lives.
// `tools/measure_corpus.mjs` says it for the corpus run and it holds
// here: "a Python reimplementation of the measurement would be
// evaluating the reimplementation". The reducer is `blinkStep`. A
// replay that re-derives its rules in another language is a second
// detector wearing the first one's name, and every rule it drifts on
// is a wrong explanation delivered with confidence.
//
// WHAT MAKES THE REPLAY FAITHFUL rather than a reconstruction: the
// trace carries `blinkLineMm`, the EFFECTIVE line the detector
// compared against on that frame, recorded at the time. Row 10.13a put
// it there for exactly this reason. Without it a replay would have to
// guess the line, and "did it dip below the line" is the whole
// question.

/**
 * One row of a clip's per-frame trace.
 *
 * The shape `src/core/frameTrace.ts` writes and
 * `tools/measure_corpus.mjs` saves as `<clip>.frames.csv`, narrowed to
 * the fields a replay needs. `irisAspectRatio` is deliberately absent:
 * it is a second closure witness the autopsy reads, and this tool is
 * about the detector's state rather than about the signal.
 */
export type TraceRow = {
  /** The frame the stepper aimed at, in the annotators' numbering. */
  frameIndex: number;
  /** The clip's own clock at that frame. */
  mediaTimeSeconds: number;
  /** What the instrument read, or null when no trusted face was. */
  apertureMm: number | null;
  /** The effective line the detector compared against, or null. */
  blinkLineMm: number | null;
};

/**
 * The detector's state around one frame of the replay.
 *
 * BOTH sides are kept, and that is not redundancy. A miss is explained
 * by what the detector was HOLDING when the aperture crossed the line:
 * whether the re-arm gate was open, how long since the last counted
 * blink. The after state has already been changed by that crossing, so
 * reading it would answer a slightly different question and the
 * difference is invisible in a table.
 */
export type ReplayedFrame = {
  frameIndex: number;
  /** The clip's clock in milliseconds, which is what the reducer takes. */
  nowMs: number;
  before: BlinkState;
  after: BlinkState;
};

/**
 * Run a clip's trace through the detector and return its state at
 * every frame.
 *
 * A frame with no aperture or no line is passed through as the
 * detector saw it: `blinkStep` takes a null aperture and breaks the
 * closure cycle, which is what "we could not watch this blink from
 * start to finish" means. A null LINE is passed the same way rather
 * than substituted, because a made-up line would put the replay
 * somewhere the detector never was.
 *
 * Refuses a trace whose frames go backwards. `blinkStep` ignores a
 * backwards frame by design, so a replay over a disordered trace would
 * quietly measure a different clip from the one recorded. A corpus
 * trace is written in order; out of order is a defect upstream and is
 * worth stopping for rather than absorbing.
 */
export function replayTrace(rows: readonly TraceRow[]): ReplayedFrame[] {
  const replayed: ReplayedFrame[] = [];
  let state = initialBlinkState;
  let previousFrameIndex: number | null = null;
  for (const row of rows) {
    if (previousFrameIndex !== null && row.frameIndex <= previousFrameIndex) {
      throw new Error(
        `trace frames must be in increasing order: ${String(previousFrameIndex)} ` +
          `then ${String(row.frameIndex)}. The detector ignores a backwards ` +
          "frame, so replaying a disordered trace measures a clip that was " +
          "never recorded",
      );
    }
    previousFrameIndex = row.frameIndex;
    const nowMs = row.mediaTimeSeconds * 1000;
    const before = state;
    // A frame the detector was not fed is replayed as one: null
    // aperture is what `blinkStep` takes for "no trusted face", and a
    // null line means the same thing one step earlier.
    const after =
      row.blinkLineMm === null
        ? blinkStep(before, nowMs, null, 0)
        : blinkStep(before, nowMs, row.apertureMm, row.blinkLineMm);
    replayed.push({ frameIndex: row.frameIndex, nowMs, before, after });
    state = after;
  }
  return replayed;
}

/**
 * A blink a human marked, in the annotators' own frame numbering.
 *
 * `startFrame` and `endFrame` are the annotation's closed span, which
 * is what `analysis/tools/miss_autopsy.py` scopes to. The two tables
 * are meant to be joined on `blinkId`, so the same span means the same
 * thing in both.
 *
 * `clip` says which video those frame numbers count within. It is not
 * decoration: every clip in the corpus is numbered from its own frame
 * 0, so a span from one clip measured against another clip's trace
 * does not fall off the end — it lands on real frames of the wrong
 * video and reports an ordinary-looking crossing for a closure that
 * never happened. `missFacts` refuses that, and needs the clip on the
 * span to see it.
 */
export type MissSpan = {
  blinkId: string;
  clip: string;
  startFrame: number;
  endFrame: number;
};

/**
 * What the detector was doing while a blink the human marked went
 * uncounted. Roadmap 10.8a's three quantities, and nothing else.
 *
 * NO VERDICT COLUMN, deliberately. `miss_autopsy.py` can already say
 * that the aperture crossed the line and no blink was logged — its
 * `crossed_line` case, which names the re-arm gate and the refractory
 * window together and cannot separate them. These three quantities
 * separate them. Which one actually accounts for which miss is a
 * conclusion about data that does not exist yet, and a column asserting
 * it now would be pre-registering the answer instead of the question.
 * A later row, scored against the run, draws that line.
 *
 * Every state-machine quantity is null when there was no crossing. The
 * detector was never given a closure to suppress, so the question does
 * not apply — which is a different thing from a zero, and a zero here
 * would read as "suppressed by nothing at all".
 */
export type MissFacts = {
  blinkId: string;
  startFrame: number;
  endFrame: number;
  /** The first frame inside the marked span that read below the line. */
  crossingFrame: number | null;
  /**
   * The first frame at or after the crossing where the lid cleared the
   * line by the hysteresis gap — the re-arm line.
   *
   * Searched past `endFrame` on purpose. The span is the human's
   * judgement of the blink; the lid clearing the re-arm line is the
   * detector's business and routinely happens after it. Null when the
   * trace ends first, because reporting the last frame as a reopening
   * would invent an event.
   */
  reopenFrame: number | null;
  /** Crossing to reopening, on the clip's own clock. */
  crossingToReopenMs: number | null;
  /**
   * From the end of the last COUNTED blink to the moment this closure
   * COMPLETED — the first frame at or above the line again.
   *
   * Measured there and not at the crossing, because that is where
   * `blinkStep` tests it: the refractory comparison lives in the OPEN
   * branch, `nowMs - state.lastBlinkEndedAtMs < BLINK_REFRACTORY_MS`,
   * evaluated on the frame the eye reopens. A distance measured at the
   * crossing is a different quantity that happens to have the same
   * units, and comparing it to the 150 ms constant would be comparing
   * two things that are not the same measurement.
   *
   * Null before the first counted blink: nothing has happened to
   * measure from, and a zero would read as "immediately after a
   * blink", which is the opposite of the truth.
   */
  msSincePreviousBlink: number | null;
  /** The re-arm gate as the detector held it entering the crossing. */
  rearmedAtCrossing: boolean | null;
};

/**
 * The three quantities for each miss, from one full-clip replay.
 *
 * Milliseconds rather than frames throughout, because the thresholds
 * these are read against are in milliseconds: a clip at another rate
 * would otherwise report a different quantity under the same name.
 */
export function missFacts(
  clip: string,
  rows: readonly TraceRow[],
  misses: readonly MissSpan[],
): MissFacts[] {
  // The trace is one clip's. A span from another clip lands on real
  // frames here and comes back with a plausible crossing for a closure
  // that never happened, so one foreign span poisons the whole answer:
  // refuse the batch rather than return a partial one that looks whole.
  const foreign = misses.find((miss) => miss.clip !== clip);
  if (foreign !== undefined) {
    throw new Error(
      `miss ${foreign.blinkId} is clip "${foreign.clip}" but this replay ` +
        `is of "${clip}". Every clip is numbered from its own frame 0, so a ` +
        "span measured against another clip's trace reports an " +
        "ordinary-looking crossing for a closure that never happened. Group " +
        "the miss table by clip and replay each against its own trace",
    );
  }
  const replayed = replayTrace(rows);
  // The replay is one entry per row, in order, so a row's state is at
  // its own index. Looked up by frame number instead, the lookup could
  // never miss, and a fallback nobody can reach is a branch nobody can
  // honestly test.
  const stateAt = (row: TraceRow): ReplayedFrame =>
    replayed[rows.indexOf(row)] as ReplayedFrame;
  return misses.map((miss) => {
    const inSpan = rows.filter(
      (row) =>
        row.frameIndex >= miss.startFrame && row.frameIndex <= miss.endFrame,
    );
    const dips = inSpan.filter(
      (row) =>
        row.apertureMm !== null &&
        row.blinkLineMm !== null &&
        row.apertureMm < row.blinkLineMm,
    );
    // ANCHOR ON THE CLOSURE THAT ARMED, not on the first dip.
    //
    // Found by an adversarial review, and it is the failure this tool
    // exists to avoid: a plausible number attributed to the wrong
    // event. A shallow wobble can cross the line and come back without
    // ever reaching arm depth, and the detector treats it as nothing.
    // If a real closure follows inside the same annotation span, THAT
    // is the one the refractory window judged. Anchoring on the first
    // dip reported a real measurement of a closure the detector never
    // evaluated, and both numbers look entirely ordinary in a table.
    //
    // A lid that wobbles before it blinks is exactly the behaviour the
    // re-arm gate was added for, so this is not a contrived case.
    //
    // When nothing in the span armed, the first dip is the right
    // anchor and the quantities then describe a closure that never got
    // close enough to count, which is itself the answer.
    const armed = dips.find((row) => stateAt(row).after.armed);
    const crossing = armed ?? dips[0];
    if (crossing === undefined) {
      return {
        blinkId: miss.blinkId,
        startFrame: miss.startFrame,
        endFrame: miss.endFrame,
        crossingFrame: null,
        reopenFrame: null,
        crossingToReopenMs: null,
        msSincePreviousBlink: null,
        rearmedAtCrossing: null,
      };
    }
    const reopen = rows.find(
      (row) =>
        row.frameIndex > crossing.frameIndex &&
        row.apertureMm !== null &&
        row.blinkLineMm !== null &&
        row.apertureMm >= row.blinkLineMm * (1 + APERTURE_HYSTERESIS_FRACTION),
    );
    // Where the closure ENDS, which is a different frame from where the
    // re-arm gate opens: the eye is back at the line here and has to
    // rise a further hysteresis gap to clear the gate.
    const completion = rows.find(
      (row) =>
        row.frameIndex > crossing.frameIndex &&
        row.apertureMm !== null &&
        row.blinkLineMm !== null &&
        row.apertureMm >= row.blinkLineMm,
    );
    const atCompletion =
      completion === undefined ? undefined : stateAt(completion);
    const lastEnded = atCompletion?.before.lastBlinkEndedAtMs ?? null;
    return {
      blinkId: miss.blinkId,
      startFrame: miss.startFrame,
      endFrame: miss.endFrame,
      crossingFrame: crossing.frameIndex,
      reopenFrame: reopen?.frameIndex ?? null,
      crossingToReopenMs:
        reopen === undefined
          ? null
          : (reopen.mediaTimeSeconds - crossing.mediaTimeSeconds) * 1000,
      msSincePreviousBlink:
        lastEnded === null ? null : (atCompletion?.nowMs ?? 0) - lastEnded,
      rearmedAtCrossing: stateAt(crossing).before.rearmed,
    };
  });
}
