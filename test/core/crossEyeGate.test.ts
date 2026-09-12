import { describe, expect, it } from "vitest";

import {
  CROSS_EYE_DISAGREEMENT_MM,
  mergedApertureMm,
} from "../../src/core/crossEyeGate";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.7b. The live aperture is the mean of two eyes, and a
// mean has no opinion about its inputs: when one eye's landmarks
// break — glare on a lens, an occluded corner — the wreck and the
// good eye average into a number that looks like a measurement. The
// gate refuses the merge when the eyes disagree by more than the
// measured distribution can explain, and the threshold is DERIVED
// from 10.7a's committed cross-eye distribution rather than chosen:
// twice the measured p95, the same clear-it-by-a-factor stance
// 12.0a's adoption margin takes, because a refusal line at the
// tail's own edge would refuse one honest frame in twenty by
// construction.

describe("the threshold is derived, not chosen", () => {
  it("sits at or above the p95 the noise-floor document committed", () => {
    // The 10.10b pattern: the constant is held to the document that
    // derived it, so a threshold quietly lowered below the measured
    // tail reddens the build unless the document carries the stated
    // reason.
    const doc = readRepoFile("docs/aperture-noise-floor.txt", repoRoot());
    const match = doc.match(/cross-eye p95 mm: (\d+\.\d+)/);
    expect(match).not.toBeNull();
    const p95 = Number((match as RegExpMatchArray)[1]);
    expect(p95).toBeGreaterThan(0);
    expect(CROSS_EYE_DISAGREEMENT_MM).toBeGreaterThanOrEqual(p95);
  });

  it("is exactly twice that p95, the derivation with no discretion in it", () => {
    const doc = readRepoFile("docs/aperture-noise-floor.txt", repoRoot());
    const match = doc.match(/cross-eye p95 mm: (\d+\.\d+)/);
    const p95 = Number((match as RegExpMatchArray)[1]);
    expect(CROSS_EYE_DISAGREEMENT_MM).toBeCloseTo(2 * p95, 10);
  });
});

describe("the merge refuses what the distribution cannot explain", () => {
  it("means two agreeing eyes, the unchanged case", () => {
    expect(mergedApertureMm(8.0, 8.2)).toBeCloseTo(8.1, 10);
  });

  it("refuses a disagreement past the threshold, never averages it", () => {
    // 5.0 vs 9.0 is a 4 mm split: no honest pair of eyes measured by
    // 10.7a ever came close, so one of these numbers is not an eye.
    expect(mergedApertureMm(9.0, 5.0)).toBeNull();
  });

  it("still merges exactly at the threshold, the house boundary rule", () => {
    // Exactly at the line is inside the line, the same convention the
    // blink arm and the shut line keep, so the two gates cannot
    // disagree about what a boundary means. Anchored at zero so the
    // difference is the constant itself to the last bit, rather than
    // a float sum that lands one ulp past it.
    const left = 0;
    const right = CROSS_EYE_DISAGREEMENT_MM;
    expect(mergedApertureMm(left, right)).toBeCloseTo((left + right) / 2, 10);
  });

  it("refuses just past the threshold, from either side", () => {
    const just = CROSS_EYE_DISAGREEMENT_MM + 0.001;
    expect(mergedApertureMm(8.0, 8.0 + just)).toBeNull();
    expect(mergedApertureMm(8.0 + just, 8.0)).toBeNull();
  });

  it("refuses when either eye is missing, which is not a disagreement", () => {
    // One eye alone cannot vouch for itself: null-in, null-out, the
    // same answer the inline mean always gave for a missing eye.
    expect(mergedApertureMm(null, 8.0)).toBeNull();
    expect(mergedApertureMm(8.0, null)).toBeNull();
    expect(mergedApertureMm(null, null)).toBeNull();
  });
});
