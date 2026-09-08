import { blinkStep, initialBlinkState, type BlinkState } from "./blink";

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
