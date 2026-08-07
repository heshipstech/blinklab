import type { FeatureRecord } from "./featureRecord";

// The demo score: one number a person can glance at, built so a
// person can also audit it. It starts at 100 and loses points
// through four NAMED penalties, each a documented linear ramp with a
// cap, and the caps sum to exactly 100, so the identity
//
//   score = 100 - sum(contributions)
//
// holds with no clamping anywhere. Points are whole numbers, so the
// identity is integer arithmetic, never floating point luck. This is
// a demo heuristic, not a medical or safety measurement, and the UI
// says so beside every score.
//
// Every ramp FLOOR is priced above this instrument's own documented
// normal range, not from the literature's numbers. Adversarial
// review caught the first draft charging ordinary blinking: the
// literature's ranges assume instruments that read differently from
// ours, the same trap amendment 5 and 6 already sprang on PERCLOS.
// A resting person must score 100, or the number teaches nothing.

// The scored window, measured in TIME, never in row counts: the
// record cadence drifts and a paused tab produces no rows at all,
// so a row window would silently bridge gaps and charge closures
// from ten minutes ago. Same discipline as every other window here.
export const SCORE_WINDOW_MS = 60000;

// Eyes closed share (PERCLOS): the most validated drowsiness proxy
// carries the most weight. The owner's documented resting reading is
// one to three percent (MANUAL item 40), so the ramp starts above it
// at five percent and saturates at fifteen.
export const PERCLOS_PENALTY_MAX = 40;
export const PERCLOS_RAMP_FLOOR = 0.05;
export const PERCLOS_RAMP_CEIL = 0.15;

// Long closures inside the scored window: the microsleep shape.
// Charged per event, because each one is an event, not a gradient.
export const LONG_CLOSURE_PENALTY_EACH = 15;
export const LONG_CLOSURE_PENALTY_MAX = 30;

// Slow blinks: the owner's own recorded blinks measure 117 to 133 ms
// closed (4.3), and MANUAL item 24 documents natural blinks at 80 to
// 200 ms, so the ramp starts above that band at 250 ms and saturates
// at 450, short of the 500 ms line where a closure stops being a
// blink at all and becomes 6.2's business.
export const BLINK_DURATION_PENALTY_MAX = 15;
export const BLINK_DURATION_RAMP_FLOOR_MS = 250;
export const BLINK_DURATION_RAMP_CEIL_MS = 450;

// Sluggish lids: the amplitude over velocity ratio from 4.5, the
// literature's drowsiness shape. MANUAL item 26 documents this
// instrument's NORMAL blinks at 30 to 150 ms A/V, so the ramp starts
// at the top of that band and saturates at double it.
export const LID_SLUGGISH_PENALTY_MAX = 15;
export const LID_SLUGGISH_RAMP_FLOOR_MS = 150;
export const LID_SLUGGISH_RAMP_CEIL_MS = 300;

export type Contribution = {
  name: string;
  points: number;
  // False means the signal had no trustworthy value this minute: it
  // contributes zero points and says so, rather than silently
  // scoring the absence as alertness.
  available: boolean;
};

export type ScoreBreakdown = {
  score: number;
  contributions: Contribution[];
};

// A linear ramp from floor to ceiling, capped at both ends, in whole
// points. Rounding is HALF UP by convention (Math.round), pinned by
// test so the convention cannot drift into floor or ceil unnoticed.
function rampPoints(
  value: number,
  floor: number,
  ceil: number,
  maxPoints: number,
): number {
  const fraction = Math.min(Math.max((value - floor) / (ceil - floor), 0), 1);
  return Math.round(fraction * maxPoints);
}

// Scores the last minute of FeatureRecords, selected by timestamp
// from the newest row backwards. Null until that window has a
// PERCLOS value, because a score without its heaviest signal would
// be a guess wearing a number, and null whenever the newest row saw
// no face: adversarial review caught an empty seat scoring worse and
// worse as the open samples aged out of PERCLOS's window, until it
// asserted maximum drowsiness about a chair. No face, no score.
export function scoreRecords(
  records: readonly FeatureRecord[],
): ScoreBreakdown | null {
  const newest = records[records.length - 1];
  if (newest === undefined || !newest.faceDetected || newest.perclos === null) {
    return null;
  }
  const windowStartMs = newest.timestampMs - SCORE_WINDOW_MS;
  const windowed = records.filter(
    (record) => record.timestampMs >= windowStartMs,
  );
  const oldest = windowed[0];
  if (oldest === undefined) {
    return null;
  }

  const perclosContribution: Contribution = {
    name: "eyes closed share",
    points: rampPoints(
      newest.perclos,
      PERCLOS_RAMP_FLOOR,
      PERCLOS_RAMP_CEIL,
      PERCLOS_PENALTY_MAX,
    ),
    available: true,
  };

  // Closures BEFORE the window are history, not present drowsiness:
  // only the count's growth inside the window is charged. The floor
  // at zero is defensive: a restart clears the counter and the rows
  // together, but a negative delta must never mint points back.
  const closureDelta = Math.max(
    0,
    newest.longClosureCount - oldest.longClosureCount,
  );
  const closureContribution: Contribution = {
    name: "long closures",
    points: Math.min(
      closureDelta * LONG_CLOSURE_PENALTY_EACH,
      LONG_CLOSURE_PENALTY_MAX,
    ),
    available: true,
  };

  const durationContribution: Contribution =
    newest.lastBlinkDurationMs === null
      ? { name: "slow blinks", points: 0, available: false }
      : {
          name: "slow blinks",
          points: rampPoints(
            newest.lastBlinkDurationMs,
            BLINK_DURATION_RAMP_FLOOR_MS,
            BLINK_DURATION_RAMP_CEIL_MS,
            BLINK_DURATION_PENALTY_MAX,
          ),
          available: true,
        };

  const sluggishContribution: Contribution =
    newest.lastBlinkAmplitudeMm === null ||
    newest.lastBlinkPeakVelocityMmPerS === null ||
    newest.lastBlinkPeakVelocityMmPerS <= 0
      ? { name: "sluggish lids", points: 0, available: false }
      : {
          name: "sluggish lids",
          points: rampPoints(
            (newest.lastBlinkAmplitudeMm / newest.lastBlinkPeakVelocityMmPerS) *
              1000,
            LID_SLUGGISH_RAMP_FLOOR_MS,
            LID_SLUGGISH_RAMP_CEIL_MS,
            LID_SLUGGISH_PENALTY_MAX,
          ),
          available: true,
        };

  const contributions = [
    perclosContribution,
    closureContribution,
    durationContribution,
    sluggishContribution,
  ];
  const totalPenalty = contributions.reduce((sum, c) => sum + c.points, 0);
  return { score: 100 - totalPenalty, contributions };
}
