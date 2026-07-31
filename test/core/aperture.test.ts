import { describe, expect, it } from "vitest";

import { apertureMm, aperturePx, irisWidthPx } from "../../src/core/aperture";
import {
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";
import { syntheticFace } from "../fixtures/syntheticFace";

// The synthetic space is square, so both frame sides are 1000 px.
const W = 1000;
const H = 1000;

describe("apertureMm across distances, the flagship claim", () => {
  const distances = [350, 500, 650, 800];

  it("keeps the millimetre value exactly stable while pixels swing", () => {
    const mmValues: number[] = [];
    const pxValues: number[] = [];
    for (const distanceMm of distances) {
      const face = syntheticFace({ distanceMm, apertureMm: 10 });
      const mm = apertureMm(
        face,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        W,
        H,
      );
      const px = aperturePx(face, RIGHT_EYE_EAR_INDICES, W, H);
      expect(mm).not.toBeNull();
      expect(px).not.toBeNull();
      if (mm !== null && px !== null) {
        mmValues.push(mm);
        pxValues.push(px);
      }
    }
    for (const mm of mmValues) {
      expect(mm).toBeCloseTo(10, 10);
    }
    const pxMin = Math.min(...pxValues);
    const pxMax = Math.max(...pxValues);
    expect(pxMax / pxMin).toBeGreaterThan(2);
  });

  it("still reports true millimetres when the aperture itself changes", () => {
    const face = syntheticFace({ distanceMm: 600, apertureMm: 4 });
    expect(
      apertureMm(face, RIGHT_EYE_EAR_INDICES, RIGHT_IRIS_RING_INDICES, W, H),
    ).toBeCloseTo(4, 10);
  });
});

describe("degenerate inputs", () => {
  it("returns null when the iris has no width instead of dividing", () => {
    const face = syntheticFace({ distanceMm: 500 });
    const centre = face[RIGHT_IRIS_RING_INDICES[0] ?? 0];
    if (centre !== undefined) {
      for (const index of RIGHT_IRIS_RING_INDICES) {
        face[index] = { ...centre };
      }
    }
    expect(
      apertureMm(face, RIGHT_EYE_EAR_INDICES, RIGHT_IRIS_RING_INDICES, W, H),
    ).toBeNull();
  });

  it("returns null when landmarks are missing entirely", () => {
    expect(
      apertureMm([], RIGHT_EYE_EAR_INDICES, RIGHT_IRIS_RING_INDICES, W, H),
    ).toBeNull();
    expect(irisWidthPx([], RIGHT_IRIS_RING_INDICES, W, H)).toBeNull();
  });
});

describe("apertureMm against the recorded fixture", () => {
  it("lands the median of 300 real frames in a plausible human range", () => {
    const session = loadSession01();
    const values: number[] = [];
    for (const frame of session.frames) {
      const mm = apertureMm(
        frameLandmarks(frame),
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        1280,
        720,
      );
      if (mm !== null) {
        values.push(mm);
      }
    }
    expect(values.length).toBe(300);
    const median = [...values].sort((a, b) => a - b)[150] ?? 0;
    expect(median).toBeGreaterThan(4);
    expect(median).toBeLessThan(16);
  });
});
