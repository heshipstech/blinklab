import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import {
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { eyeAspectRatio, eyeLandmarksFromFace } from "../../src/core/ear";
import { syntheticFace } from "../fixtures/syntheticFace";

const ROLLS = [0, 15, 30];

function mmAt(rollDeg: number, distanceMm = 500): number | null {
  return apertureMm(
    syntheticFace({ distanceMm, apertureMm: 10, rollDeg }),
    RIGHT_EYE_EAR_INDICES,
    RIGHT_IRIS_RING_INDICES,
    1000,
    1000,
  );
}

describe("tilt invariance, the ladder's 0, 15, 30 check", () => {
  it("keeps the millimetre aperture identical at every roll", () => {
    for (const rollDeg of ROLLS) {
      expect(mmAt(rollDeg)).toBeCloseTo(10, 10);
    }
  });

  it("keeps the EAR identical at every roll too", () => {
    for (const rollDeg of ROLLS) {
      const eye = eyeLandmarksFromFace(
        syntheticFace({ distanceMm: 500, apertureMm: 10, rollDeg }),
        RIGHT_EYE_EAR_INDICES,
      );
      expect(eye).not.toBeNull();
      if (eye !== null) {
        expect(eyeAspectRatio(eye)).toBeCloseTo(10 / 30, 10);
      }
    }
  });

  it("holds under roll and distance combined", () => {
    expect(mmAt(30, 800)).toBeCloseTo(10, 10);
  });
});

describe("the counterfactual: the bug we did not write", () => {
  // A naive implementation measures the VERTICAL DROP between the
  // lid landmarks instead of the distance between them. This test
  // implements that mistake locally and shows exactly what it costs.
  function naiveVerticalApertureMm(rollDeg: number): number {
    const face = syntheticFace({ distanceMm: 500, apertureMm: 10, rollDeg });
    const upper = face[RIGHT_EYE_EAR_INDICES.upperOuter];
    const lower = face[RIGHT_EYE_EAR_INDICES.lowerOuter];
    const ringRight = face[RIGHT_IRIS_RING_INDICES[0] ?? -1];
    const ringLeft = face[RIGHT_IRIS_RING_INDICES[2] ?? -1];
    if (
      upper === undefined ||
      lower === undefined ||
      ringRight === undefined ||
      ringLeft === undefined
    ) {
      throw new Error("landmarks missing");
    }
    const verticalDropPx = Math.abs(upper.y - lower.y) * 1000;
    const irisPx = Math.hypot(
      (ringRight.x - ringLeft.x) * 1000,
      (ringRight.y - ringLeft.y) * 1000,
    );
    return verticalDropPx * (11.7 / irisPx);
  }

  it("shrinks by exactly cos(roll), which our distances never do", () => {
    const level = naiveVerticalApertureMm(0);
    const tilted = naiveVerticalApertureMm(30);
    expect(level).toBeCloseTo(10, 6);
    expect(tilted / level).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 6);
  });
});
