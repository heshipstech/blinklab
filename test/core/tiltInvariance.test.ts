import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import {
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { eyeAspectRatio, eyeLandmarksFromFace } from "../../src/core/ear";
import type { Point2 } from "../../src/core/geometry";
import { syntheticFace } from "../fixtures/syntheticFace";

const ROLLS = [0, 15, 30];

// A real webcam frame. Until 11 August 2026 this file proved roll
// invariance on a square 1000x1000 frame, where normalised x and y are
// the same unit and the aspect ratio trap CANNOT appear. The displayed
// eye aspect ratio had fallen into exactly that trap, reading 1.78x
// the standard definition and drifting 27 percent under roll, and this
// file kept passing. The audit's verdict was that a proof run where
// the defect cannot occur proves nothing, so the frame is 16:9 now.
const FRAME_W = 1280;
const FRAME_H = 720;

// The synthetic generator emits square normalised space. Re-project
// into what a 16:9 camera delivers for the SAME physical scene: treat
// the square coordinates as physical pixels on a frame 720 tall,
// centre that strip, and renormalise x by the wider frame.
function widescreen(face: readonly Point2[]): Point2[] {
  return face.map((p) => ({
    x: (p.x * FRAME_H + (FRAME_W - FRAME_H) / 2) / FRAME_W,
    y: p.y,
  }));
}

function mmAt(rollDeg: number, distanceMm = 500): number | null {
  return apertureMm(
    widescreen(syntheticFace({ distanceMm, apertureMm: 10, rollDeg })),
    RIGHT_EYE_EAR_INDICES,
    RIGHT_IRIS_RING_INDICES,
    FRAME_W,
    FRAME_H,
  );
}

function earAt(rollDeg: number): number | null {
  const eye = eyeLandmarksFromFace(
    widescreen(syntheticFace({ distanceMm: 500, apertureMm: 10, rollDeg })),
    RIGHT_EYE_EAR_INDICES,
  );
  return eye === null ? null : eyeAspectRatio(eye, FRAME_W, FRAME_H);
}

describe("tilt invariance, the ladder's 0, 15, 30 check, on a 16:9 frame", () => {
  it("keeps the millimetre aperture identical at every roll", () => {
    for (const rollDeg of ROLLS) {
      expect(mmAt(rollDeg)).toBeCloseTo(10, 8);
    }
  });

  it("keeps the EAR identical at every roll too", () => {
    for (const rollDeg of ROLLS) {
      expect(earAt(rollDeg)).toBeCloseTo(10 / 30, 8);
    }
  });

  it("holds under roll and distance combined", () => {
    expect(mmAt(30, 800)).toBeCloseTo(10, 8);
  });

  it("still holds on a square frame, where the old test lived", () => {
    const eye = eyeLandmarksFromFace(
      syntheticFace({ distanceMm: 500, apertureMm: 10, rollDeg: 30 }),
      RIGHT_EYE_EAR_INDICES,
    );
    expect(eye).not.toBeNull();
    if (eye !== null) {
      expect(eyeAspectRatio(eye, 1000, 1000)).toBeCloseTo(10 / 30, 10);
    }
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

describe("the counterfactual: the bug we did write, and fixed", () => {
  // Until 11 August 2026 eyeAspectRatio ran directly on normalised
  // coordinates. This reimplements that version locally, on the same
  // 16:9 frames the real tests above use, and pins what it cost: the
  // level reading inflated to 1.78x the true ratio, and a quantity
  // SPEC.md declared roll invariant fell 27 percent by 30 degrees.
  // If these numbers ever stop reproducing, the synthetic geometry
  // changed and the story in LEARNING.md needs re-checking.
  function normalisedSpaceEar(rollDeg: number): number {
    const face = widescreen(
      syntheticFace({ distanceMm: 500, apertureMm: 10, rollDeg }),
    );
    const eye = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
    if (eye === null) {
      throw new Error("landmarks missing");
    }
    const d = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
    return (
      (d(eye.upperOuter, eye.lowerOuter) + d(eye.upperInner, eye.lowerInner)) /
      (2 * d(eye.outerCorner, eye.innerCorner))
    );
  }

  it("inflates the level reading by the frame's aspect ratio", () => {
    expect(normalisedSpaceEar(0)).toBeCloseTo(0.5926, 3);
    // Exactly the aspect ratio, not approximately: the level chords are
    // exactly vertical, the eye width exactly horizontal, and pure roll
    // keeps the face in-plane, so the projection is a similarity. Ten
    // digits, because the equality is algebraic.
    expect(normalisedSpaceEar(0) / (10 / 30)).toBeCloseTo(
      FRAME_W / FRAME_H,
      10,
    );
  });

  it("drifts 27 percent across the roll range the SPEC calls invariant", () => {
    const level = normalisedSpaceEar(0);
    const tilted = normalisedSpaceEar(30);
    expect(tilted / level).toBeCloseTo(0.7337, 3);
  });
});
