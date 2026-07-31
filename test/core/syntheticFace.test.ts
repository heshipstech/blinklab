import { describe, expect, it } from "vitest";

import {
  LANDMARK_COUNT,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { eyeAspectRatio, eyeLandmarksFromFace } from "../../src/core/ear";
import {
  EYE_WIDTH_MM,
  IRIS_DIAMETER_MM,
  syntheticFace,
} from "../fixtures/syntheticFace";

function irisWidthNormalized(
  face: { x: number; y: number }[],
  ring: readonly number[],
): number {
  const right = face[ring[0] ?? -1];
  const left = face[ring[2] ?? -1];
  if (right === undefined || left === undefined) {
    throw new Error("ring points missing");
  }
  return Math.hypot(right.x - left.x, right.y - left.y);
}

describe("syntheticFace", () => {
  it("always returns exactly 478 finite landmarks inside the frame", () => {
    const face = syntheticFace({ distanceMm: 400, rollDeg: 10, yawDeg: 10 });
    expect(face.length).toBe(LANDMARK_COUNT);
    const bad = face.filter(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    ).length;
    expect(bad).toBe(0);
  });

  it("projects the iris to exactly its physical size over the distance", () => {
    const face = syntheticFace({ distanceMm: 500 });
    const widthN = irisWidthNormalized(face, RIGHT_IRIS_RING_INDICES);
    expect(widthN).toBeCloseTo(IRIS_DIAMETER_MM / 500, 10);
  });

  it("halves the projected iris when the distance doubles, perspective", () => {
    const near = irisWidthNormalized(
      syntheticFace({ distanceMm: 400 }),
      RIGHT_IRIS_RING_INDICES,
    );
    const far = irisWidthNormalized(
      syntheticFace({ distanceMm: 800 }),
      RIGHT_IRIS_RING_INDICES,
    );
    expect(near / far).toBeCloseTo(2, 10);
  });

  it("gives an EAR of exactly aperture over eye width, tying into 3.1", () => {
    const face = syntheticFace({ distanceMm: 500, apertureMm: 10 });
    const eye = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
    expect(eye).not.toBeNull();
    if (eye !== null) {
      expect(eyeAspectRatio(eye)).toBeCloseTo(10 / EYE_WIDTH_MM, 10);
    }
  });

  it("shows a pure roll as exactly that angle between the iris centres", () => {
    const face = syntheticFace({ distanceMm: 500, rollDeg: 15 });
    const right = face[468];
    const left = face[473];
    expect(right).toBeDefined();
    expect(left).toBeDefined();
    if (right !== undefined && left !== undefined) {
      const angleDeg =
        (Math.atan2(left.y - right.y, left.x - right.x) * 180) / Math.PI;
      expect(angleDeg).toBeCloseTo(15, 6);
    }
  });

  it("shows yaw as left right iris asymmetry, one eye nearer than the other", () => {
    const straight = syntheticFace({ distanceMm: 500 });
    const turned = syntheticFace({ distanceMm: 500, yawDeg: 20 });
    const ratioStraight =
      irisWidthNormalized(straight, RIGHT_IRIS_RING_INDICES) /
      irisWidthNormalized(straight, LEFT_IRIS_RING_INDICES);
    const ratioTurned =
      irisWidthNormalized(turned, RIGHT_IRIS_RING_INDICES) /
      irisWidthNormalized(turned, LEFT_IRIS_RING_INDICES);
    expect(ratioStraight).toBeCloseTo(1, 10);
    expect(Math.abs(ratioTurned - 1)).toBeGreaterThan(0.05);
  });

  it("shows pitch as a foreshortened aperture, EAR shrinks", () => {
    const level = syntheticFace({ distanceMm: 500, apertureMm: 10 });
    const tilted = syntheticFace({
      distanceMm: 500,
      apertureMm: 10,
      pitchDeg: 30,
    });
    const earOf = (face: ReturnType<typeof syntheticFace>) => {
      const eye = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
      return eye === null ? null : eyeAspectRatio(eye);
    };
    const levelEar = earOf(level);
    const tiltedEar = earOf(tilted);
    expect(levelEar).not.toBeNull();
    expect(tiltedEar).not.toBeNull();
    if (levelEar !== null && tiltedEar !== null) {
      expect(tiltedEar).toBeLessThan(levelEar * 0.95);
    }
  });
});
