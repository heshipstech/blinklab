import { describe, expect, it } from "vitest";

import { FEATURE_RECORD_CAP } from "../../src/core/featureRecord";
import {
  DRIFT_LABEL,
  MIN_BLINKS_PER_HALF,
  parameterDrift,
  timeOnTaskMs,
} from "../../src/core/blinkDrift";
import type { BlinkEvent } from "../../src/core/blinkLog";

// Roadmap 12.14. Does a person's blinking change over the length of a
// sitting? The obvious place to look is the per-second buffer, and it
// is the wrong place: it keeps FEATURE_RECORD_CAP rows, about an hour,
// and drops the oldest. A three-hour session asked that buffer when it
// started would be told an hour ago, so "drift since the beginning"
// would silently mean "drift since the buffer wrapped" — a real number
// about a session that did not happen.
//
// The blink log is the record that survives it: one event per blink,
// each stamped with when it ended, held to a cap thirty times longer.
// So the drift is computed from the log and measured against the
// session's TRUE start, which is passed in rather than inferred from
// whatever is still in a buffer.

/** A blink event carrying only what this module reads. */
function blink(atMs: number, durationMs: number): BlinkEvent {
  return {
    atMs,
    durationMs,
    shape: null,
    startFrame: null,
    endFrame: null,
  };
}

/** `count` blinks evenly spread across [fromMs, toMs], all one length. */
function spread(
  count: number,
  fromMs: number,
  toMs: number,
  durationMs: number,
): BlinkEvent[] {
  const step = (toMs - fromMs) / (count - 1);
  return Array.from({ length: count }, (_, n) =>
    blink(fromMs + n * step, durationMs),
  );
}

const HOUR_MS = 3600000;

// The halves are split at the midpoint between the session start and
// the LAST blink, so a fixture whose two groups touch at the hour mark
// would put one blink on the far side of the boundary and blunt the
// number it is asserting. These two ranges leave a minute between
// them, which puts the midpoint in the gap and each group wholly
// inside its own half.
const EARLY_END = HOUR_MS - 60000;
const LATE_END = 2 * HOUR_MS - 60000;

describe("time on task", () => {
  it("is measured from the session start it is given", () => {
    expect(timeOnTaskMs(blink(5000, 200), 2000)).toBe(3000);
  });

  it("refuses a blink stamped before the session began", () => {
    // Not a negative time on task. A blink from before the start is a
    // defect in whatever assembled the log, and a negative elapsed
    // would sort into the early half and drag its mean.
    expect(() => timeOnTaskMs(blink(1000, 200), 2000)).toThrow(/before/);
  });
});

describe("drift across a sitting", () => {
  it("is null when either half is too thin to mean anything", () => {
    const events = [
      ...spread(3, 0, EARLY_END, 200),
      ...spread(40, HOUR_MS, LATE_END, 300),
    ];
    expect(parameterDrift(events, 0, (event) => event.durationMs)).toBeNull();
  });

  it("reports no change for a person who does not change", () => {
    const events = spread(80, 0, 2 * HOUR_MS, 250);
    const drift = parameterDrift(events, 0, (event) => event.durationMs);
    expect(drift).not.toBeNull();
    expect(drift?.changeFraction).toBeCloseTo(0, 10);
  });

  it("reports the change as a fraction of where it started", () => {
    // 200 ms becoming 300 ms is half again as long. Reported as 0.5
    // rather than as 100 ms, because 100 ms means something different
    // to a 200 ms blink and a 600 ms one, and an absolute difference
    // would smuggle blink length into a measure of change.
    const events = [
      ...spread(40, 0, EARLY_END, 200),
      ...spread(40, HOUR_MS, LATE_END, 300),
    ];
    const drift = parameterDrift(events, 0, (event) => event.durationMs);
    expect(drift?.earlyMean).toBeCloseTo(200, 10);
    expect(drift?.lateMean).toBeCloseTo(300, 10);
    expect(drift?.changeFraction).toBeCloseTo(0.5, 10);
  });

  it("splits the session by TIME, not by how many blinks fell where", () => {
    // Ninety blinks in the first hour and thirty in the second. A
    // split by count would put the boundary deep inside hour one and
    // report a change that is mostly hour one against itself.
    const events = [
      ...spread(90, 0, EARLY_END, 200),
      ...spread(30, HOUR_MS, LATE_END, 400),
    ];
    const drift = parameterDrift(events, 0, (event) => event.durationMs);
    expect(drift?.earlyMean).toBeCloseTo(200, 10);
    expect(drift?.lateMean).toBeCloseTo(400, 10);
  });

  it("reads whichever parameter it is handed", () => {
    const withShape = (atMs: number, amplitudeMm: number): BlinkEvent => ({
      atMs,
      durationMs: 200,
      shape: {
        amplitudeMm,
        peakClosingVelocityMmPerS: 50,
        amplitudeOverVelocityMs: 4,
      },
      startFrame: null,
      endFrame: null,
    });
    const events = [
      ...Array.from({ length: 40 }, (_, n) => withShape(n * 10000, 6)),
      ...Array.from({ length: 40 }, (_, n) =>
        withShape(HOUR_MS + n * 10000, 3),
      ),
    ];
    const drift = parameterDrift(
      events,
      0,
      (event) => event.shape?.amplitudeMm ?? null,
    );
    expect(drift?.changeFraction).toBeCloseTo(-0.5, 10);
  });

  it("skips blinks whose parameter was never measured", () => {
    // A blink whose shape could not be analysed has no amplitude. It
    // must not count as an amplitude of zero, which would drag the
    // half it landed in toward a change nobody made.
    const events = spread(80, 0, 2 * HOUR_MS, 250);
    expect(
      parameterDrift(events, 0, (event) =>
        event.atMs < HOUR_MS ? null : event.durationMs,
      ),
    ).toBeNull();
  });

  it("refuses fourteen in a half and answers fifteen, by the literals", () => {
    // Written as 14 and 15 rather than from MIN_BLINKS_PER_HALF on
    // purpose. A probe derived from the constant it holds moves with
    // it, and the floor then passes at any position, which is what
    // row 10.1c learned and row 12.9 had to learn again.
    expect(
      parameterDrift(
        [
          ...spread(14, 0, EARLY_END, 200),
          ...spread(15, HOUR_MS, LATE_END, 300),
        ],
        0,
        (event) => event.durationMs,
      ),
    ).toBeNull();
    expect(
      parameterDrift(
        [
          ...spread(15, 0, EARLY_END, 200),
          ...spread(14, HOUR_MS, LATE_END, 300),
        ],
        0,
        (event) => event.durationMs,
      ),
    ).toBeNull();
    const both = parameterDrift(
      [...spread(15, 0, EARLY_END, 200), ...spread(15, HOUR_MS, LATE_END, 300)],
      0,
      (event) => event.durationMs,
    );
    expect(both?.changeFraction).toBeCloseTo(0.5, 10);
  });

  it("refuses a change measured from a starting mean of zero", () => {
    const events = spread(80, 0, 2 * HOUR_MS, 0);
    expect(parameterDrift(events, 0, (event) => event.durationMs)).toBeNull();
  });
});

describe("the buffer wrap, which is the whole reason this row exists", () => {
  it("measures a multi-hour session against its true start", () => {
    // Three hours at one blink every thirty seconds is 360 blinks, and
    // the per-second buffer holds one hour of rows. Somebody reading
    // drift out of that buffer would be told the session began at the
    // two-hour mark, and would report the last hour against itself.
    //
    // Here the parameter climbs steadily across the whole three hours.
    // Measured from the true start the second half is meaningfully
    // longer than the first. Measured from a wrapped buffer it would
    // barely move, and the assertion below separates the two.
    const total = 3 * HOUR_MS;
    const events = Array.from({ length: 360 }, (_, n) => {
      const atMs = n * 30000;
      return blink(atMs, 200 + (atMs / total) * 200);
    });

    const trueStart = parameterDrift(events, 0, (event) => event.durationMs);
    expect(trueStart?.changeFraction).toBeCloseTo(0.4, 2);

    const wrapped = events.filter(
      (event) => event.atMs >= total - FEATURE_RECORD_CAP * 1000,
    );
    const fromWrap = parameterDrift(
      wrapped,
      total - FEATURE_RECORD_CAP * 1000,
      (event) => event.durationMs,
    );
    expect(fromWrap).not.toBeNull();
    // Stated against the true reading rather than against a number
    // typed here, so the assertion says what it means: the wrapped
    // view understates the change by more than half.
    expect(fromWrap?.changeFraction ?? 0).toBeLessThan(
      (trueStart?.changeFraction ?? 0) / 2,
    );
  });

  it("keeps blinks the per-second buffer would have dropped", () => {
    // The log's own cap is thirty times the buffer's, which is the
    // fact that makes this row possible at all. Stated as a test so a
    // change to either constant has to face it.
    expect(FEATURE_RECORD_CAP).toBe(3600);
    expect(MIN_BLINKS_PER_HALF).toBe(15);
  });
});

describe("the label", () => {
  it("says this is a demonstration and not a validated claim", () => {
    expect(DRIFT_LABEL).toMatch(/demonstration/i);
    expect(DRIFT_LABEL).not.toMatch(/\bfatigue\b|\bdrowsy\b|\bdrowsiness\b/i);
  });
});
