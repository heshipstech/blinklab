import { BASELINE_LEARN_MS } from "./constants";
import { percentile } from "./statistics";

// The cued ground-truth schedule. Roadmap 11.0a, ladder C4, audit
// F-071.
//
// Every live claim this project makes about catching blinks rests on
// the count-ten protocol: a person presses Mark, blinks ten times
// counting out loud, presses Mark again. docs/validation-round.txt
// records what that cost. Markers are stamped up to about a second
// early, one participant pressed Mark three times instead of twice,
// and one verdict had to be refused outright because the eleventh
// detection sat 0.46 seconds inside the marker slack and a shift
// could have changed the count. The ground truth was a person
// operating a button while doing the thing being measured.
//
// Here the ground truth is the schedule. It is fixed in this module
// before any camera runs, exactly as lightSchedule.ts fixes the light
// stimulus, so what the person was asked to do and when is known to
// the millisecond. The only thing left to measure is whether the
// detector saw it.
//
// This module is PURE: which cue is due at a given moment from the
// start, and how a list of detected events scores against the cues.
// Nothing about the screen, the clock or the camera. Row 11.0b paints
// the overlay and writes the export rows.
//
// This row measures nothing. It is the instrument rows 11.6 and 13.3
// will measure through, which is why no prediction document sits
// beside it: there is no number here to be wrong about yet.

/** What the person is asked to do. */
export type CueKind = "blink" | "close3" | "close20" | "lookAway" | "rest";

/** One instruction, with when it starts and how long it stands. */
export type Cue = {
  kind: CueKind;
  atMs: number;
  holdMs: number;
};

/**
 * The silence before the first cue.
 *
 * The baseline's own learning window, not a round number chosen for
 * looking tidy. A cue delivered before the baseline is ready would be
 * scored against a detector holding no line at all, and its miss would
 * be the protocol's fault rather than the instrument's.
 */
export const CUE_SETTLE_MS = BASELINE_LEARN_MS;

/**
 * How long after a cue a detected event still counts as its response.
 *
 * A CHOICE, pre-registered here before any session is run, and not a
 * derivation — saying otherwise would dress up a judgement as a
 * measurement. What can be said about it:
 *
 *   - It must exceed MAX_BLINK_DURATION_MS, or a blink that took as
 *     long as blinks are allowed to take would score as a miss.
 *   - It must be shorter than the rest that follows a cue, or one
 *     cue's window reaches into the next and a late response to the
 *     first counts as an early response to the second.
 *   - Within those bounds it should be generous, because a miss
 *     caused by a slow person is indistinguishable here from a miss
 *     caused by the detector, and this instrument exists to measure
 *     the second.
 *
 * Two seconds sits inside those bounds with room either side. The
 * scorer reports the latency of every caught cue, so once real
 * sessions exist this can be re-chosen FROM the distribution rather
 * than argued about again — and a change to it is a dated amendment,
 * because a window widened after seeing the data is a window fitted
 * to the answer.
 */
export const CUE_RESPONSE_WINDOW_MS = 2_000;

/** The rest after each instruction, long enough to close its window. */
const REST_MS = 4_000;
/** How long a "blink now" instruction stands on screen. */
const BLINK_HOLD_MS = 1_000;
/** How long "look away from the screen" stands. */
const LOOK_AWAY_MS = 5_000;
/** How many blinks the protocol asks for. */
const BLINK_COUNT = 10;

/**
 * The schedule, built once from the parts above.
 *
 * Ten blinks, then the two closures, then a look-away, each followed
 * by a rest. Ten because the retired protocol asked for ten, so a
 * catch rate from this schedule is comparable with the round I
 * sessions it replaces rather than being a different quantity wearing
 * the same name.
 */
function buildSchedule(): { cues: Cue[]; totalMs: number } {
  const cues: Cue[] = [];
  let atMs = CUE_SETTLE_MS;
  const push = (kind: CueKind, holdMs: number) => {
    cues.push({ kind, atMs, holdMs });
    atMs += holdMs;
  };
  for (let i = 0; i < BLINK_COUNT; i += 1) {
    push("blink", BLINK_HOLD_MS);
    push("rest", REST_MS);
  }
  push("close3", 3_000);
  push("rest", REST_MS);
  push("close20", 20_000);
  push("rest", REST_MS);
  push("lookAway", LOOK_AWAY_MS);
  push("rest", REST_MS);
  // The running cursor IS the end of the last cue, so the total cannot
  // disagree with the layout: both come out of the same loop. Reading
  // it back off the last element afterwards would need a fallback for
  // an empty schedule, and a fallback for a state the construction
  // rules out is a number waiting to be wrong.
  return { cues, totalMs: atMs };
}

const SCHEDULE = buildSchedule();

export const CUE_SCHEDULE: readonly Cue[] = SCHEDULE.cues;

/** The end of the last rest: the whole protocol, settle included. */
export const CUE_TOTAL_MS = SCHEDULE.totalMs;

/** Just the blink instructions, which are what a catch rate counts. */
export function blinkCues(): Cue[] {
  return CUE_SCHEDULE.filter((cue) => cue.kind === "blink");
}

/**
 * The cue due `elapsedMs` after the protocol started.
 *
 * "settle" covers everything before the first cue, a negative elapsed
 * included: a clock that ran backwards is not an instruction, and must
 * not misread as one. "done" covers everything at or past the end.
 */
export function cueAt(elapsedMs: number): Cue | "settle" | "done" {
  return cueAmong(CUE_SCHEDULE, CUE_TOTAL_MS, elapsedMs);
}

/**
 * The same walk over an arbitrary cue list — the scaled one, in
 * practice (roadmap 11.0b). The settle boundary is the first cue's own
 * start, which for the real schedule IS `CUE_SETTLE_MS` by
 * construction, so `cueAt` above delegates here without moving.
 */
export function cueAmong(
  cues: readonly Cue[],
  totalMs: number,
  elapsedMs: number,
): Cue | "settle" | "done" {
  const first = cues[0];
  if (first === undefined || elapsedMs < first.atMs) {
    return "settle";
  }
  if (elapsedMs >= totalMs) {
    return "done";
  }
  // The schedule is contiguous from the settle to the end, which a
  // test proves, so between those two guards the cue in force is
  // simply the last one that has started. Written as a scan rather
  // than a find-with-a-fallback: a fallback here would silently
  // report "done" in the middle of the protocol and the overlay would
  // stop cueing, which is the worst way for this to fail.
  let current: Cue | "settle" = "settle";
  for (const cue of cues) {
    if (elapsedMs >= cue.atMs) {
      current = cue;
    }
  }
  return current;
}

/**
 * The schedule with every time multiplied by `scale` (roadmap 11.0b).
 *
 * The row's Check demands the end-to-end test drive a SHORTENED
 * schedule — two minutes of real protocol is not a wiring test — and
 * the honest way to shorten is in the open: the export's
 * `cue_time_scale` row carries the scale, 1.000 on every real
 * session, so a scaled run can never pass as one.
 */
export function scaledCues(scale: number): { cues: Cue[]; totalMs: number } {
  return {
    cues: CUE_SCHEDULE.map((cue) => ({
      kind: cue.kind,
      atMs: cue.atMs * scale,
      holdMs: cue.holdMs * scale,
    })),
    totalMs: CUE_TOTAL_MS * scale,
  };
}

/**
 * The test hook, read from the page's own query string.
 *
 * 1 for anything but a finite value in (0, 1]: a scale above 1 is a
 * longer protocol nobody pre-registered, zero and below are not a
 * schedule, and garbage is garbage — all of them run the real thing
 * rather than a guessed variant.
 */
/**
 * What the overlay says at each moment of the protocol.
 *
 * Pure so the words are testable, and worded around one physical
 * fact: closed eyes cannot read a screen. Every cue boundary sounds a
 * tone (the io half's job), so the closure instructions hand their
 * ending to the ear rather than to text nobody can see.
 */
export function cueOverlayText(current: Cue | "settle" | "done"): string {
  if (current === "settle") {
    return (
      "Hold still and look at the screen. The cues begin once the " +
      "baseline has learned your open eyes."
    );
  }
  if (current === "done") {
    return (
      "Done. Press Escape or tap to close, then stop the camera and " +
      "export the session."
    );
  }
  switch (current.kind) {
    case "blink":
      return "Blink now";
    case "close3":
      return "Close your eyes until the next tone (about 3 seconds)";
    case "close20":
      return "Close your eyes until the next tone (about 20 seconds)";
    case "lookAway":
      return "Look away from the screen";
    case "rest":
      return "Rest. Look at the screen.";
  }
}

export function cueTimeScale(search: string): number {
  const raw = new URLSearchParams(search).get("cueTimeScale");
  if (raw === null) {
    return 1;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 1;
}

/**
 * One thing the detector reported, and which detector reported it.
 *
 * The kind is not decoration. A "close your eyes for twenty seconds"
 * cue cannot be answered by a blink, and a scorer that took an
 * untyped stream would count one as answering the other: the first
 * version of this module did exactly that, and its own tests caught
 * it before any of it ran.
 */
export type DetectedEvent = {
  kind: "blink" | "closure";
  startMs: number;
  durationMs: number;
};

/**
 * The detector that can answer each cue, or null when none can.
 *
 * `lookAway` is null on purpose. Nothing in the blink or closure path
 * sees a person turning away from the screen; gaze does, and this
 * scorer does not read gaze. Scoring it against a closure would make
 * a look-away that produced no blink read as a detector miss, which
 * would be a number about nothing.
 */
export function answeringDetector(kind: CueKind): "blink" | "closure" | null {
  if (kind === "blink") {
    return "blink";
  }
  if (kind === "close3" || kind === "close20") {
    return "closure";
  }
  return null;
}

/** What happened at one cue. */
export type CueOutcome = {
  cue: Cue;
  caught: boolean;
  /** Milliseconds from the cue to the response, null when missed. */
  latencyMs: number | null;
  /**
   * For a closure cue: how far the measured duration fell from the
   * cued one, signed, negative when the instrument read it short.
   * Null for a blink cue and for a miss.
   *
   * Reported rather than turned into a pass mark. A closure cued at
   * twenty seconds and measured at eighteen is not a miss, it is a
   * two-second error, and that number is the one row 13.3 wants. A
   * threshold here would throw it away and invent a bar besides.
   */
  durationErrorMs: number | null;
};

export type CueScore =
  | {
      kind: "scored";
      outcomes: CueOutcome[];
      caught: number;
      missed: number;
      medianLatencyMs: number | null;
      /**
       * Every event the session held, cued or not.
       *
       * Reported beside the tally because the scorer cannot defend
       * against a person who blinks continuously: they DO respond to
       * every cue, and no arrangement of windows tells that apart from
       * obedience. What gives it away is the rate, so the rate travels
       * with the score.
       */
      eventsSeen: number;
    }
  | {
      kind: "refused";
      reason:
        "session-too-short" | "session-too-long" | "event-before-first-cue";
    };

/**
 * How much longer than the schedule a session may run.
 *
 * The export button is pressed by a person, so a real recording always
 * runs a little past the last cue. A refusal that fired on that would
 * refuse every honest session; one that never fired would score events
 * from long after the protocol against cues that had finished.
 */
const OVERRUN_ALLOWANCE_MS = 30_000;

/**
 * Score a session's detected events against the schedule.
 *
 * Each cue is caught by the FIRST event starting within the response
 * window after it, and an event can catch at most one cue. Both halves
 * matter: a person who blinks five times at one cue has not caught
 * five cues, and a cue already caught cannot be caught again.
 */
export function scoreCues(
  events: readonly DetectedEvent[],
  sessionDurationMs: number,
): CueScore {
  if (sessionDurationMs < CUE_TOTAL_MS) {
    return { kind: "refused", reason: "session-too-short" };
  }
  if (sessionDurationMs > CUE_TOTAL_MS + OVERRUN_ALLOWANCE_MS) {
    return { kind: "refused", reason: "session-too-long" };
  }
  if (events.some((event) => event.startMs < CUE_SETTLE_MS)) {
    return { kind: "refused", reason: "event-before-first-cue" };
  }

  const used = new Set<number>();
  const outcomes: CueOutcome[] = [];
  const latencies: number[] = [];
  for (const cue of CUE_SCHEDULE) {
    const wanted = answeringDetector(cue.kind);
    if (wanted === null) {
      // Rests, and the look-away nothing here can see.
      continue;
    }
    let caughtAt: number | null = null;
    let durationErrorMs: number | null = null;
    for (const [index, event] of events.entries()) {
      if (used.has(index) || event.kind !== wanted) {
        continue;
      }
      const latency = event.startMs - cue.atMs;
      if (latency >= 0 && latency <= CUE_RESPONSE_WINDOW_MS) {
        used.add(index);
        caughtAt = latency;
        if (wanted === "closure") {
          durationErrorMs = event.durationMs - cue.holdMs;
        }
        break;
      }
    }
    outcomes.push({
      cue,
      caught: caughtAt !== null,
      latencyMs: caughtAt,
      durationErrorMs,
    });
    if (caughtAt !== null) {
      latencies.push(caughtAt);
    }
  }

  const caught = outcomes.filter((outcome) => outcome.caught).length;
  return {
    kind: "scored",
    outcomes,
    caught,
    missed: outcomes.length - caught,
    medianLatencyMs: percentile(latencies, 50),
    eventsSeen: events.length,
  };
}
