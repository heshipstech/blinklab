import { describe, expect, it } from "vitest";

import { recordDue } from "../../src/core/recordGate";

// Roadmap 14.0d (audit A26): the once-per-second record used to ride
// the animation clock alone, so a camera that froze kept producing
// rows from the same photograph until someone noticed. When delivery
// is observed, a row needs a frame that arrived since the last row.

const UNOBSERVED = {
  observed: false,
  deliveredCount: 0,
  deliveredCountAtLastRecord: 0,
};

describe("when a per-second record may be written", () => {
  it("the first record of an unobserved source waits for nothing", () => {
    // A clip, or a browser without the delivery callback: the frame
    // handler runs only on frames, so the tick is the evidence.
    expect(recordDue({ lastRecordAtMs: null, nowMs: 0, ...UNOBSERVED })).toBe(
      true,
    );
  });

  it("a second is the cadence, inclusive", () => {
    expect(recordDue({ lastRecordAtMs: 0, nowMs: 999, ...UNOBSERVED })).toBe(
      false,
    );
    expect(recordDue({ lastRecordAtMs: 0, nowMs: 1000, ...UNOBSERVED })).toBe(
      true,
    );
  });

  it("an observed camera must have delivered a frame since the last record", () => {
    const frozen = {
      lastRecordAtMs: 0,
      nowMs: 1000,
      observed: true,
      deliveredCount: 30,
      deliveredCountAtLastRecord: 30,
    };
    expect(recordDue(frozen)).toBe(false);
    expect(recordDue({ ...frozen, deliveredCount: 31 })).toBe(true);
  });

  it("the first record of an observed camera waits for the first frame", () => {
    const beforeFirst = {
      lastRecordAtMs: null,
      nowMs: 0,
      observed: true,
      deliveredCount: 0,
      deliveredCountAtLastRecord: 0,
    };
    expect(recordDue(beforeFirst)).toBe(false);
    expect(recordDue({ ...beforeFirst, deliveredCount: 1 })).toBe(true);
  });

  it("a delivered frame does not shorten the second", () => {
    // Delivery is a necessary condition, never a sufficient one: a
    // 60 fps camera must not turn the cadence into 60 rows a second.
    expect(
      recordDue({
        lastRecordAtMs: 0,
        nowMs: 500,
        observed: true,
        deliveredCount: 31,
        deliveredCountAtLastRecord: 30,
      }),
    ).toBe(false);
  });
});
