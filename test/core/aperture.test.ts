import { describe, expect, it } from "vitest";

import {
  apertureMm,
  aperturePx,
  irisAspectRatio,
  irisWidthPx,
} from "../../src/core/aperture";
import {
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
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

describe("irisAspectRatio, the second closure witness", () => {
  // The vertical iris chord (top to bottom) over the horizontal one
  // (right to left, the aperture's own ruler). An open iris is a
  // circle, so the ratio is 1; as a lid covers the top rim the
  // vertical chord shrinks and the ratio falls. It reads the iris rim,
  // not the lid, so it is independent of apertureMm. Prediction for
  // what it does on the Eyeblink8 misses: docs/iris-occlusion.txt.

  it("reads 1 on an open iris across distances, a ratio of two chords", () => {
    // A ratio of two same-instant pixel chords: distance cancels, so
    // the open-eye value is 1 at every distance, no ruler needed.
    for (const distanceMm of [350, 500, 800]) {
      const face = syntheticFace({ distanceMm });
      expect(irisAspectRatio(face, RIGHT_IRIS_RING_INDICES, W, H)).toBeCloseTo(
        1,
        10,
      );
    }
  });

  it("falls when the lid occludes the top rim", () => {
    const face = syntheticFace({ distanceMm: 500 });
    expect(irisAspectRatio(face, RIGHT_IRIS_RING_INDICES, W, H)).toBeCloseTo(
      1,
      10,
    );
    // Collapse the top rim point onto the iris centre: the visible
    // vertical extent halves, so the ratio must fall to about 0.5.
    const centre = face[RIGHT_IRIS_CENTER_INDEX];
    const topIndex = RIGHT_IRIS_RING_INDICES[1];
    if (centre !== undefined && topIndex !== undefined) {
      face[topIndex] = { ...centre };
    }
    expect(irisAspectRatio(face, RIGHT_IRIS_RING_INDICES, W, H)).toBeCloseTo(
      0.5,
      6,
    );
  });

  it("returns null when the iris has no horizontal width", () => {
    const face = syntheticFace({ distanceMm: 500 });
    const right = face[RIGHT_IRIS_RING_INDICES[0] ?? 0];
    const leftIndex = RIGHT_IRIS_RING_INDICES[2];
    if (right !== undefined && leftIndex !== undefined) {
      face[leftIndex] = { ...right };
    }
    expect(irisAspectRatio(face, RIGHT_IRIS_RING_INDICES, W, H)).toBeNull();
  });

  it("returns null when landmarks are missing entirely", () => {
    expect(irisAspectRatio([], RIGHT_IRIS_RING_INDICES, W, H)).toBeNull();
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
