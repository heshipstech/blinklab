import { describe, expect, it } from "vitest";

import { apertureMm, aperturePx } from "../../src/core/aperture";
import {
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import {
  coefficientOfVariation,
  mean,
  standardDeviation,
} from "../../src/core/statistics";
import { syntheticFace } from "../fixtures/syntheticFace";

describe("mean and standard deviation", () => {
  it("solve hand checkable values", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(standardDeviation([2, 4, 6])).toBeCloseTo(1.632993, 5);
  });

  it("return null for no samples instead of guessing", () => {
    expect(mean([])).toBeNull();
    expect(standardDeviation([])).toBeNull();
  });
});

describe("coefficientOfVariation", () => {
  it("is the standard deviation priced in means, hand checkable", () => {
    expect(coefficientOfVariation([2, 4, 6])).toBeCloseTo(1.632993 / 4, 5);
  });

  it("is zero for perfectly steady values", () => {
    expect(coefficientOfVariation([5, 5, 5, 5])).toBe(0);
  });

  it("returns null when the mean is at or below zero, division refused", () => {
    expect(coefficientOfVariation([])).toBeNull();
    expect(coefficientOfVariation([0, 0, 0])).toBeNull();
    expect(coefficientOfVariation([-2, 2])).toBeNull();
  });
});

describe("the lean in, lean out experiment, the ladder's claim", () => {
  it("CV(mm) is far below CV(px) across synthetic distances", () => {
    const distances = [350, 425, 500, 575, 650, 725, 800];
    const pxValues: number[] = [];
    const mmValues: number[] = [];
    for (const distanceMm of distances) {
      const face = syntheticFace({ distanceMm, apertureMm: 10 });
      const px = aperturePx(face, RIGHT_EYE_EAR_INDICES, 1000, 1000);
      const mm = apertureMm(
        face,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        1000,
        1000,
      );
      if (px !== null && mm !== null) {
        pxValues.push(px);
        mmValues.push(mm);
      }
    }
    expect(pxValues.length).toBe(distances.length);
    const cvPx = coefficientOfVariation(pxValues);
    const cvMm = coefficientOfVariation(mmValues);
    expect(cvPx).not.toBeNull();
    expect(cvMm).not.toBeNull();
    if (cvPx !== null && cvMm !== null) {
      expect(cvMm).toBeLessThan(cvPx);
      expect(cvMm).toBeLessThan(0.001);
      expect(cvPx).toBeGreaterThan(0.25);
    }
  });
});
