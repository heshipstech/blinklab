import { describe, expect, it } from "vitest";

import type { FeatureRecord } from "../../src/core/featureRecord";
import {
  PERCLOS_PENALTY_MAX,
  PERCLOS_RAMP_CEIL,
  PERCLOS_RAMP_FLOOR,
  LONG_CLOSURE_PENALTY_EACH,
  LONG_CLOSURE_PENALTY_MAX,
  BLINK_DURATION_PENALTY_MAX,
  BLINK_DURATION_RAMP_CEIL_MS,
  BLINK_DURATION_RAMP_FLOOR_MS,
  LID_SLUGGISH_PENALTY_MAX,
  LID_SLUGGISH_RAMP_CEIL_MS,
  LID_SLUGGISH_RAMP_FLOOR_MS,
  SCORE_WINDOW_MS,
  scoreRecords,
} from "../../src/core/score";

// A minute of records built from one template: alert unless staged
// otherwise. Fields not involved in scoring stay constant.
function minute(overrides: Partial<FeatureRecord>[]): FeatureRecord[] {
  return overrides.map((over, i) => ({
    timestampMs: i * 1000,
    faceDetected: true,
    fps: 60,
    apertureMm: 7,
    baselineMm: 7.2,
    shutBaselineMm: 7.2,
    baselineOverResting: 1.03,
    blinkRatePerMin: 15,
    lastBlinkDurationMs: 120,
    lastBlinkAmplitudeMm: 4,
    lastBlinkPeakVelocityMmPerS: 100,
    perclos: 0.01,
    longClosureCount: 0,
    fixationCount: 10,
    fixationMedianMs: 300,
    fixating: true,
    onScreen: true,
    pupilDiameterMm: null,
    ...over,
  }));
}

function steadyMinute(over: Partial<FeatureRecord>): FeatureRecord[] {
  return minute(Array.from({ length: 60 }, () => over));
}

const ALERT_MINUTE = steadyMinute({});

function sumOfContributions(records: FeatureRecord[]): void {
  const result = scoreRecords(records);
  expect(result).not.toBeNull();
  if (result !== null) {
    const sum = result.contributions.reduce((a, c) => a + c.points, 0);
    expect(100 - sum).toBe(result.score);
  }
}

describe("the ladder's check: contributions sum to the score", () => {
  it("holds for a fully alert minute, score exactly 100", () => {
    const result = scoreRecords(ALERT_MINUTE);
    expect(result?.score).toBe(100);
    expect(result?.contributions.every((c) => c.points === 0)).toBe(true);
    sumOfContributions(ALERT_MINUTE);
  });

  it("holds at staged maximum drowsiness, score exactly 0", () => {
    const drowsy = minute(
      Array.from({ length: 60 }, (_, i) => ({
        perclos: 0.2,
        longClosureCount: i < 30 ? 0 : 2,
        lastBlinkDurationMs: 450,
        lastBlinkAmplitudeMm: 3,
        lastBlinkPeakVelocityMmPerS: 10,
      })),
    );
    const result = scoreRecords(drowsy);
    expect(result?.score).toBe(0);
    sumOfContributions(drowsy);
  });

  it("holds for mixed staged minutes, the identity is exact", () => {
    const mixes = [
      steadyMinute({ perclos: 0.085 }),
      minute(
        Array.from({ length: 60 }, (_, i) => ({
          longClosureCount: i < 50 ? 0 : 1,
        })),
      ),
      steadyMinute({ lastBlinkDurationMs: 300 }),
      steadyMinute({
        perclos: 0.09,
        lastBlinkAmplitudeMm: 4,
        lastBlinkPeakVelocityMmPerS: 18,
      }),
    ];
    for (const records of mixes) {
      sumOfContributions(records);
    }
  });
});

describe("the ramps are priced above this instrument's normal ranges", () => {
  it("scores the owner's documented resting numbers at exactly 100", () => {
    // The regression test for the defect adversarial review caught:
    // the first draft's ramps started INSIDE the ranges the manual
    // documents as normal, so ordinary blinking cost real points.
    // These are the owner's own recorded values: PERCLOS 3 percent
    // (item 40), blink 133 ms (4.3), A/V 65 ms from 3.4 mm at 52
    // mm/s (item 26's band). A resting person scores 100 or the
    // number teaches nothing.
    const resting = steadyMinute({
      perclos: 0.03,
      lastBlinkDurationMs: 133,
      lastBlinkAmplitudeMm: 3.4,
      lastBlinkPeakVelocityMmPerS: 52,
    });
    expect(scoreRecords(resting)?.score).toBe(100);
  });

  it("keeps every floor above the manual's documented normal top", () => {
    // Manual item 40: resting PERCLOS one to three percent.
    // Manual item 24: natural blinks 80 to 200 ms closed.
    // Manual item 26: natural blink A/V 30 to 150 ms.
    expect(PERCLOS_RAMP_FLOOR).toBeGreaterThan(0.03);
    expect(BLINK_DURATION_RAMP_FLOOR_MS).toBeGreaterThan(200);
    expect(LID_SLUGGISH_RAMP_FLOOR_MS).toBeGreaterThanOrEqual(150);
  });
});

describe("the PERCLOS ramp", () => {
  const scoreAtPerclos = (perclos: number): number | undefined =>
    scoreRecords(steadyMinute({ perclos }))?.score;

  it("runs the ramp trio: floor, midpoint, ceiling", () => {
    expect(scoreAtPerclos(PERCLOS_RAMP_FLOOR)).toBe(100);
    expect(scoreAtPerclos((PERCLOS_RAMP_FLOOR + PERCLOS_RAMP_CEIL) / 2)).toBe(
      100 - PERCLOS_PENALTY_MAX / 2,
    );
    expect(scoreAtPerclos(PERCLOS_RAMP_CEIL)).toBe(100 - PERCLOS_PENALTY_MAX);
  });

  it("pins the floor and ceiling values themselves", () => {
    // Without these, nudging a constant leaves every ramp test
    // passing because they all derive from the constant.
    expect(PERCLOS_RAMP_FLOOR).toBe(0.05);
    expect(PERCLOS_RAMP_CEIL).toBe(0.15);
    expect(scoreAtPerclos(0.1)).toBe(80);
  });

  it("caps beyond the ceiling instead of overflowing", () => {
    expect(scoreAtPerclos(0.5)).toBe(100 - PERCLOS_PENALTY_MAX);
    expect(scoreAtPerclos(1)).toBe(100 - PERCLOS_PENALTY_MAX);
  });
});

describe("the blink duration ramp", () => {
  const scoreAtDuration = (lastBlinkDurationMs: number): number | undefined =>
    scoreRecords(steadyMinute({ lastBlinkDurationMs }))?.score;

  it("runs the ramp trio: floor, midpoint, ceiling", () => {
    expect(scoreAtDuration(BLINK_DURATION_RAMP_FLOOR_MS)).toBe(100);
    expect(
      scoreAtDuration(
        (BLINK_DURATION_RAMP_FLOOR_MS + BLINK_DURATION_RAMP_CEIL_MS) / 2,
      ),
    ).toBe(100 - Math.round(BLINK_DURATION_PENALTY_MAX / 2));
    expect(scoreAtDuration(BLINK_DURATION_RAMP_CEIL_MS)).toBe(
      100 - BLINK_DURATION_PENALTY_MAX,
    );
  });

  it("pins the floor and ceiling values themselves", () => {
    expect(BLINK_DURATION_RAMP_FLOOR_MS).toBe(250);
    expect(BLINK_DURATION_RAMP_CEIL_MS).toBe(450);
    expect(scoreAtDuration(200)).toBe(100);
    expect(scoreAtDuration(350)).toBe(92);
  });

  it("caps beyond the ceiling: a longer closure is 6.2's business", () => {
    expect(scoreAtDuration(2000)).toBe(100 - BLINK_DURATION_PENALTY_MAX);
  });
});

describe("the sluggish lid ramp", () => {
  // A/V in milliseconds from amplitude in mm over velocity in mm/s.
  // Velocity is held at 20 and the amplitude derived, because that
  // pair divides exactly in binary floating point: deriving the
  // velocity instead lands at 224.99999999999997 and the test would
  // be measuring IEEE754, not the ramp.
  const scoreAtRatio = (ratioMs: number): number | undefined =>
    scoreRecords(
      steadyMinute({
        lastBlinkAmplitudeMm: ratioMs / 50,
        lastBlinkPeakVelocityMmPerS: 20,
      }),
    )?.score;

  it("runs the ramp trio: floor, midpoint, ceiling", () => {
    expect(scoreAtRatio(LID_SLUGGISH_RAMP_FLOOR_MS)).toBe(100);
    expect(
      scoreAtRatio(
        (LID_SLUGGISH_RAMP_FLOOR_MS + LID_SLUGGISH_RAMP_CEIL_MS) / 2,
      ),
    ).toBe(100 - Math.round(LID_SLUGGISH_PENALTY_MAX / 2));
    expect(scoreAtRatio(LID_SLUGGISH_RAMP_CEIL_MS)).toBe(
      100 - LID_SLUGGISH_PENALTY_MAX,
    );
  });

  it("pins the floor and ceiling values themselves", () => {
    expect(LID_SLUGGISH_RAMP_FLOOR_MS).toBe(150);
    expect(LID_SLUGGISH_RAMP_CEIL_MS).toBe(300);
    expect(scoreAtRatio(100)).toBe(100);
    expect(scoreAtRatio(200)).toBe(95);
  });

  it("refuses to divide by a zero or negative velocity", () => {
    const zeroVelocity = steadyMinute({
      lastBlinkAmplitudeMm: 4,
      lastBlinkPeakVelocityMmPerS: 0,
    });
    const result = scoreRecords(zeroVelocity);
    expect(result?.score).toBe(100);
    expect(
      result?.contributions.find((c) => c.name === "sluggish lids")?.available,
    ).toBe(false);
  });
});

describe("the rounding convention", () => {
  it("rounds half up, pinned so it cannot drift to floor or ceil", () => {
    // 294 ms sits at 3.3 raw points: round gives 3, ceil would give
    // 4. 300 ms sits at 3.75: round gives 4, floor would give 3.
    // Together they kill both drifts.
    expect(
      scoreRecords(steadyMinute({ lastBlinkDurationMs: 294 }))?.score,
    ).toBe(97);
    expect(
      scoreRecords(steadyMinute({ lastBlinkDurationMs: 300 }))?.score,
    ).toBe(96);
  });
});

describe("the long closure penalty", () => {
  const scoreWithClosures = (delta: number): number | undefined =>
    scoreRecords(
      minute(
        Array.from({ length: 60 }, (_, i) => ({
          longClosureCount: i < 30 ? 0 : delta,
        })),
      ),
    )?.score;

  it("charges per closure in the window, computed as the count delta", () => {
    expect(scoreWithClosures(1)).toBe(100 - LONG_CLOSURE_PENALTY_EACH);
    expect(scoreWithClosures(2)).toBe(100 - 2 * LONG_CLOSURE_PENALTY_EACH);
  });

  it("caps at the documented maximum", () => {
    expect(scoreWithClosures(5)).toBe(100 - LONG_CLOSURE_PENALTY_MAX);
    expect(LONG_CLOSURE_PENALTY_EACH).toBe(15);
    expect(LONG_CLOSURE_PENALTY_MAX).toBe(30);
  });

  it("ignores closures that happened before the window", () => {
    // A session-long count of 4 that never changes inside the
    // window is history, not present drowsiness.
    expect(scoreRecords(steadyMinute({ longClosureCount: 4 }))?.score).toBe(
      100,
    );
  });

  it("never mints points back when the count runs backwards", () => {
    // Cannot happen in the current wiring (a restart clears the
    // counter and the rows together), but a negative delta must
    // never push the score above 100.
    const backwards = minute(
      Array.from({ length: 60 }, (_, i) => ({
        longClosureCount: i < 30 ? 3 : 1,
      })),
    );
    expect(scoreRecords(backwards)?.score).toBe(100);
    sumOfContributions(backwards);
  });
});

describe("the window is measured in time, never in rows", () => {
  it("drops rows older than the window even when the buffer is long", () => {
    // Two minutes of rows: a closure early in the first minute must
    // not charge the score in the second.
    const twoMinutes = Array.from({ length: 120 }, (_, i) => ({
      longClosureCount: i >= 10 ? 1 : 0,
    })).map((over, i) => ({ ...minute([over])[0], timestampMs: i * 1000 }));
    expect(scoreRecords(twoMinutes as FeatureRecord[])?.score).toBe(100);
  });

  it("does not bridge a recording gap, the row-count bug's own case", () => {
    // Eleven rows, a closure among them, then the tab sleeps ten
    // minutes, then eleven more rows. A row window would still be
    // holding the old closure; a time window cannot.
    const before = Array.from({ length: 11 }, (_, i) => ({
      ...minute([{ longClosureCount: i >= 5 ? 1 : 0 }])[0],
      timestampMs: i * 1000,
    }));
    const after = Array.from({ length: 11 }, (_, i) => ({
      ...minute([{ longClosureCount: 1 }])[0],
      timestampMs: 600000 + i * 1000,
    }));
    const gapped = [...before, ...after] as FeatureRecord[];
    expect(scoreRecords(gapped)?.score).toBe(100);
  });

  it("keeps a closure that happened inside the window", () => {
    const recent = Array.from({ length: 120 }, (_, i) => ({
      ...minute([{ longClosureCount: i >= 100 ? 1 : 0 }])[0],
      timestampMs: i * 1000,
    })) as FeatureRecord[];
    expect(scoreRecords(recent)?.score).toBe(100 - LONG_CLOSURE_PENALTY_EACH);
  });

  it("pins the window length itself", () => {
    expect(SCORE_WINDOW_MS).toBe(60000);
  });
});

describe("honesty rules", () => {
  it("returns null before PERCLOS exists", () => {
    expect(scoreRecords(steadyMinute({ perclos: null }))).toBeNull();
  });

  it("returns null for an empty window", () => {
    expect(scoreRecords([])).toBeNull();
  });

  it("refuses to score an empty seat, however drowsy the chair looks", () => {
    // Adversarial review's scenario, reproduced as a permanent test:
    // a five second closure, then the person leaves. PERCLOS keeps
    // its value while the open samples age out of ITS window, so the
    // ratio climbs and the score would sink toward maximum drowsiness
    // about an empty chair. The newest row says faceDetected false,
    // and that is enough to refuse.
    const seated = Array.from({ length: 55 }, (_, i) => ({
      ...minute([{}])[0],
      timestampMs: i * 1000,
    }));
    const closure = Array.from({ length: 5 }, (_, i) => ({
      ...minute([{ perclos: 0.5 }])[0],
      timestampMs: (55 + i) * 1000,
    }));
    const gone = Array.from({ length: 30 }, (_, i) => ({
      ...minute([{ faceDetected: false, perclos: 0.9 }])[0],
      timestampMs: (60 + i) * 1000,
    }));
    const abandoned = [...seated, ...closure, ...gone] as FeatureRecord[];
    expect(scoreRecords(abandoned)).toBeNull();
    // And it resumes the moment a face returns.
    const returned = [
      ...abandoned,
      { ...minute([{}])[0], timestampMs: 90000 },
    ] as FeatureRecord[];
    expect(scoreRecords(returned)?.score).toBe(100);
  });

  it("marks unavailable signals instead of scoring them as alert", () => {
    const noShape = steadyMinute({
      lastBlinkAmplitudeMm: null,
      lastBlinkPeakVelocityMmPerS: null,
      lastBlinkDurationMs: null,
    });
    const result = scoreRecords(noShape);
    expect(result).not.toBeNull();
    const byName = new Map(result?.contributions.map((c) => [c.name, c]) ?? []);
    expect(byName.get("slow blinks")?.available).toBe(false);
    expect(byName.get("slow blinks")?.points).toBe(0);
    expect(byName.get("sluggish lids")?.available).toBe(false);
    expect(byName.get("sluggish lids")?.points).toBe(0);
    sumOfContributions(noShape);
  });

  it("marks present signals as available, the other direction", () => {
    const result = scoreRecords(ALERT_MINUTE);
    expect(result?.contributions.every((c) => c.available)).toBe(true);
  });

  it("keeps every contribution named, for the 6.6 panel", () => {
    const result = scoreRecords(ALERT_MINUTE);
    const names = result?.contributions.map((c) => c.name) ?? [];
    expect(names).toEqual([
      "eyes closed share",
      "long closures",
      "slow blinks",
      "sluggish lids",
    ]);
  });

  it("stays within 0 to 100 by construction: the caps sum to 100", () => {
    expect(
      PERCLOS_PENALTY_MAX +
        LONG_CLOSURE_PENALTY_MAX +
        BLINK_DURATION_PENALTY_MAX +
        LID_SLUGGISH_PENALTY_MAX,
    ).toBe(100);
  });
});
