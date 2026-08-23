import { describe, expect, it } from "vitest";

import {
  APERTURE_HYSTERESIS_FRACTION,
  BASELINE_THRESHOLD_FRACTION,
} from "../../src/core/constants";
import {
  armLineMm,
  deliveredDetectionRate,
  detectionRate,
  msBelow,
  type Blink,
  type Optics,
  type Sampling,
} from "../fixtures/blinkTrace";

// The delivery model, derived instead of swept.
//
// Every number in docs/blink-sample-rate.txt's tables comes from a
// numerical sweep over two phase grids. A sweep can be wrong in ways
// that look fine — a budget too coarse for the digits printed was
// exactly the defect the 21 August review caught — so this file pins
// the sweep against a CLOSED FORM reached independently, from the
// detector's own mechanics:
//
//   The detector counts the excursion iff some PROCESSED frame reads
//   an aperture at or below the arm line (arming is the only step
//   that can fail; completion is guaranteed by the settled second of
//   open eye after). The true trace sits at or below the arm line
//   for La milliseconds. A camera delivering every Pd ms photographs
//   that interval floor(La/Pd) times, or one more, with probability
//   frac(La/Pd) over a uniform delivery phase. Sample-and-hold makes
//   k below-arm frames into k*Pd milliseconds of held below-arm
//   signal, and a reader ticking every Pp ms lands in a window of
//   length D with probability min(1, D/Pp) over a uniform reading
//   phase. So:
//
//     rate = frac * min(1, ceil(La/Pd)*Pd/Pp)
//          + (1 - frac) * min(1, floor(La/Pd)*Pd/Pp)
//
// and with an infinitely fast camera the limit is min(1, La/Pp),
// which is the 17 August single-grid experiment. Two derivations,
// one from stepping the real reducer thirty million times and one
// from four lines of arithmetic, agreeing across every regime, is
// the strongest statement this harness can make that it means what
// the documents say it means.

const OPTICS: Optics = {
  openMm: 7.0,
  thresholdMm: 7.78 * BASELINE_THRESHOLD_FRACTION,
};
const ARM_MM = armLineMm(OPTICS, APERTURE_HYSTERESIS_FRACTION);

function closedFormRate(blink: Blink, sampling: Sampling): number {
  // The ARM line, not the blink threshold: arming is the step that
  // can fail, and it needs the extra depth. A test below proves the
  // distinction is load-bearing, not pedantry.
  const armDwellMs = msBelow(blink, OPTICS, ARM_MM);
  const processMs = 1000 / sampling.processHz;
  if (!Number.isFinite(sampling.deliveryHz)) {
    return Math.min(1, armDwellMs / processMs);
  }
  const deliveryMs = 1000 / sampling.deliveryHz;
  const ticks = armDwellMs / deliveryMs;
  const lower = Math.floor(ticks);
  const frac = ticks - lower;
  const caught = (k: number): number =>
    Math.min(1, (k * deliveryMs) / processMs);
  return frac * caught(lower + 1) + (1 - frac) * caught(lower);
}

// The blinks the published tables sweep, macbookair2's optics, plus
// the quick blink whose arm dwell is the shortest thing any table
// holds — the case where a discretization error would show first.
const BLINKS: [string, Blink][] = [
  ["3.2 mm", { minMm: 3.2, closeMs: 50, openMs: 100 }],
  ["3.3 mm", { minMm: 3.3, closeMs: 50, openMs: 100 }],
  ["3.4 mm", { minMm: 3.4, closeMs: 50, openMs: 100 }],
  ["2.4 mm", { minMm: 2.4, closeMs: 50, openMs: 100 }],
  ["deep", { minMm: 1.5, closeMs: 60, openMs: 120 }],
  ["quick", { minMm: 3.2, closeMs: 27, openMs: 53 }],
];

// Every regime the documents make a claim about: reader slower than
// the camera, matched, faster; camera faster than the reader,
// including the non-monotone 60/75/90/120 set; and the infinite
// camera the 17 August table assumed.
const SAMPLINGS: Sampling[] = [
  { deliveryHz: 30, processHz: 25 },
  { deliveryHz: 30, processHz: 29.2 },
  { deliveryHz: 30, processHz: 30 },
  { deliveryHz: 30, processHz: 60 },
  { deliveryHz: 60, processHz: 60 },
  { deliveryHz: 75, processHz: 60 },
  { deliveryHz: 90, processHz: 60 },
  { deliveryHz: 120, processHz: 60 },
  { deliveryHz: 25, processHz: 30 },
  { deliveryHz: Infinity, processHz: 25 },
  { deliveryHz: Infinity, processHz: 30 },
  { deliveryHz: Infinity, processHz: 60 },
];

// The sweep resolves a two-hundredth of delivery phase and msBelow
// steps a tenth of a millisecond, so the two sides cannot be asked
// to agree closer than that. Measured before this bound was chosen:
// the worst residual across all 72 cells is 0.0060, on the quick
// blink, whose arm dwell is the shortest and so discretizes worst.
// Anything past 0.0075 is a changed mechanism, not noise.
const AGREEMENT = 0.0075;

describe("the sweep and the arithmetic agree everywhere", () => {
  for (const [name, blink] of BLINKS) {
    it(`${name}, across all twelve sampling regimes`, () => {
      for (const sampling of SAMPLINGS) {
        const swept = deliveredDetectionRate(blink, OPTICS, sampling);
        const derived = closedFormRate(blink, sampling);
        expect(
          Math.abs(swept - derived),
          `delivery ${String(sampling.deliveryHz)}, ` +
            `processing ${String(sampling.processHz)}: ` +
            `swept ${swept.toFixed(4)}, derived ${derived.toFixed(4)}`,
        ).toBeLessThanOrEqual(AGREEMENT);
      }
    });
  }

  it("the infinite-camera limit is the 17 August experiment", () => {
    // min(1, La/Pp) must match the ORIGINAL single-grid sweep too,
    // which ties the closed form to the first published table
    // through a path that never touches the delivery code.
    const marginal: Blink = { minMm: 3.3, closeMs: 50, openMs: 100 };
    for (const processHz of [25, 30, 60]) {
      expect(
        Math.abs(
          detectionRate(marginal, OPTICS, processHz) -
            closedFormRate(marginal, {
              deliveryHz: Infinity,
              processHz,
            }),
        ),
      ).toBeLessThanOrEqual(AGREEMENT);
    }
  });
});

describe("the arithmetic PREDICTS the published surprises", () => {
  it("the non-monotone dip is frac and floor trading places", () => {
    // The review's finding — 0.96 at 60 Hz delivery, 0.82 at 90,
    // 0.96 at 120 — pinned from the formula alone. At 60 Hz the
    // 3.4 mm blink's arm dwell spans about 1.5 delivery periods, so
    // half the phases photograph it twice; at 90 Hz it spans about
    // 2.2 SHORTER periods whose held time is less than the reading
    // period, so more phases hold too little signal to be caught.
    // No sweep involved: the dip is in the arithmetic.
    const shallow: Blink = { minMm: 3.4, closeMs: 50, openMs: 100 };
    const at = (deliveryHz: number): number =>
      closedFormRate(shallow, { deliveryHz, processHz: 60 });
    expect(at(90)).toBeLessThan(at(60));
    expect(at(120)).toBeGreaterThan(at(90));
  });

  it("the arm line is load-bearing: the threshold form disagrees", () => {
    // The one modelling choice a plausible rederivation would get
    // wrong: the eye reads closed below the THRESHOLD, but counting
    // needs the deeper ARM line, and the trace spends real time in
    // the band between them. A closed form built on the threshold
    // dwell overshoots the sweep by far more than the agreement
    // bound, so this mistake cannot creep in quietly.
    const marginal: Blink = { minMm: 3.3, closeMs: 50, openMs: 100 };
    const sampling: Sampling = { deliveryHz: 30, processHz: 30 };
    const thresholdDwellMs = msBelow(marginal, OPTICS, OPTICS.thresholdMm);
    const wrong = Math.min(1, thresholdDwellMs / (1000 / sampling.processHz));
    const swept = deliveredDetectionRate(marginal, OPTICS, sampling);
    expect(Math.abs(wrong - swept)).toBeGreaterThan(0.05);
  });

  it("dropping the phase mixing disagrees too", () => {
    // A rederivation that rounds La/Pd to the nearest whole count
    // of photographs — no frac term — lands visibly off the sweep
    // at the commensurate points the published table prints.
    const shallow: Blink = { minMm: 3.4, closeMs: 50, openMs: 100 };
    const sampling: Sampling = { deliveryHz: 60, processHz: 60 };
    const armDwellMs = msBelow(shallow, OPTICS, ARM_MM);
    const deliveryMs = 1000 / sampling.deliveryHz;
    const rounded = Math.min(
      1,
      (Math.round(armDwellMs / deliveryMs) * deliveryMs) /
        (1000 / sampling.processHz),
    );
    const swept = deliveredDetectionRate(shallow, OPTICS, sampling);
    expect(Math.abs(rounded - swept)).toBeGreaterThan(0.03);
  });
});
