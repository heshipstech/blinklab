import { describe, expect, it } from "vitest";

import {
  CLOSURE_CLASS_LABELS,
  MICROSLEEP_RANGE_MIN_MS,
  SUSTAINED_CLOSURE_MIN_MS,
  classifyClosure,
} from "../../src/core/closureTaxonomy";
import { LONG_CLOSURE_THRESHOLD_MS } from "../../src/core/longClosure";

// Roadmap 12.6. A closure that outstays a blink is currently one
// thing: `longClosureCount`, which charges the same fifteen points
// whether the eyes were shut for six hundred milliseconds or six
// minutes. Those are not the same event and a reader told only the
// count cannot tell them apart.
//
// Three bands, and the naming is the point as much as the arithmetic.
// The middle band is "microsleep-RANGE", never "microsleep": the real
// thing is defined on the electroencephalogram and no data this
// project may use could validate it. Roadmap amendment 16 capped the
// vocabulary; this test and claimGuard are what hold the cap.

describe("the bands", () => {
  it("classifies a blink-length closure as nothing at all", () => {
    // 0.4 s is inside MAX_BLINK_DURATION_MS, so blink.ts has already
    // counted it. Naming it here too would put one closure in two
    // categories, which is the partition longClosure.ts protects.
    expect(classifyClosure(400)).toBeNull();
  });

  it("classifies 0.8 s as prolonged", () => {
    expect(classifyClosure(800)).toBe("prolonged");
  });

  it("classifies 3 s as microsleep-range", () => {
    expect(classifyClosure(3000)).toBe("microsleep-range");
  });

  it("classifies 20 s as sustained", () => {
    expect(classifyClosure(20000)).toBe("sustained");
  });
});

describe("the two-second boundary, pinned to a side", () => {
  // Written as literals rather than from MICROSLEEP_RANGE_MIN_MS on
  // purpose: a probe derived from the constant it probes moves with
  // it, and the boundary then passes at any position. Roadmap 10.1c.
  //
  // One frame period at MIN_BLINK_FPS, the slowest rate this project
  // will measure blinks at, is 40 ms. A boundary the tests hold to
  // within one frame period is a boundary the instrument can actually
  // resolve; anything finer would be pinning arithmetic the camera
  // cannot deliver.

  it("calls exactly 2.0 s prolonged, the lower side", () => {
    // Same convention as LONG_CLOSURE_THRESHOLD_MS, where at the line
    // a closure is still a blink and only strictly beyond it is long.
    // One rule for every band edge in the project.
    expect(classifyClosure(2000)).toBe("prolonged");
  });

  it("calls one frame period below it prolonged", () => {
    expect(classifyClosure(1960)).toBe("prolonged");
  });

  it("calls one frame period above it microsleep-range", () => {
    expect(classifyClosure(2040)).toBe("microsleep-range");
  });

  it("sits at two seconds", () => {
    expect(MICROSLEEP_RANGE_MIN_MS).toBe(2000);
  });
});

describe("the fifteen-second boundary, pinned the same way", () => {
  it("calls exactly 15 s microsleep-range, the lower side", () => {
    expect(classifyClosure(15000)).toBe("microsleep-range");
  });

  it("calls one frame period below it microsleep-range", () => {
    expect(classifyClosure(14960)).toBe("microsleep-range");
  });

  it("calls one frame period above it sustained", () => {
    expect(classifyClosure(15040)).toBe("sustained");
  });

  it("sits at fifteen seconds", () => {
    expect(SUSTAINED_CLOSURE_MIN_MS).toBe(15000);
  });
});

describe("the blink edge is the long-closure line itself", () => {
  it("names nothing at or below the line", () => {
    // Aliased, not copied. blink.ts counts at or below the line and
    // longClosure.ts counts strictly beyond it, so a taxonomy with
    // its own private 500 could drift and put one closure in two
    // categories or in none.
    expect(classifyClosure(LONG_CLOSURE_THRESHOLD_MS)).toBeNull();
    expect(classifyClosure(500)).toBeNull();
    expect(classifyClosure(499)).toBeNull();
  });

  it("names the first millisecond past it", () => {
    expect(classifyClosure(501)).toBe("prolonged");
  });

  it("names a closure of zero length as nothing", () => {
    expect(classifyClosure(0)).toBeNull();
  });
});

describe("durations that are not durations", () => {
  it("refuses a negative closure by name", () => {
    // A negative span is a defect in whatever produced it, not a
    // short closure, and returning null would let it pass as one.
    expect(() => classifyClosure(-1)).toThrow(/duration/);
  });

  it("refuses a closure that is not a finite number", () => {
    expect(() => classifyClosure(Number.NaN)).toThrow(/duration/);
    expect(() => classifyClosure(Number.POSITIVE_INFINITY)).toThrow(/duration/);
  });
});

describe("the words, which are the other half of this row", () => {
  it("has a label for every band and no band without one", () => {
    expect(Object.keys(CLOSURE_CLASS_LABELS).sort()).toEqual([
      "microsleep-range",
      "prolonged",
      "sustained",
    ]);
  });

  it("says microsleep-range and never microsleep on its own", () => {
    // Amendment 16: the real thing is EEG-defined and unvalidatable
    // with any data this project may use. The label may say a closure
    // fell in that RANGE of durations. It may not say what the
    // closure was.
    for (const label of Object.values(CLOSURE_CLASS_LABELS)) {
      expect(/\bmicrosleep\b(?!-range)/.test(label)).toBe(false);
    }
    expect(CLOSURE_CLASS_LABELS["microsleep-range"]).toContain(
      "microsleep-range",
    );
  });

  it("never pairs the word with detection", () => {
    for (const label of Object.values(CLOSURE_CLASS_LABELS)) {
      expect(/microsleep[ -]+(is +)?detect/i.test(label)).toBe(false);
    }
  });
});
