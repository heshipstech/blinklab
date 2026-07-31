import { describe, expect, it } from "vitest";

import {
  LEFT_EYE_EAR_INDICES,
  LEFT_EYE_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_EYE_INDICES,
} from "../../src/core/constants";
import {
  eyeAspectRatio,
  eyeLandmarksFromFace,
  type EyeLandmarks,
} from "../../src/core/ear";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

// A hand built symmetric open eye: width 6, both vertical chords 2.
// EAR = (2 + 2) / (2 * 6) = 1/3.
function openEye(): EyeLandmarks {
  return {
    outerCorner: { x: 0, y: 0 },
    innerCorner: { x: 6, y: 0 },
    upperOuter: { x: 2, y: -1 },
    lowerOuter: { x: 2, y: 1 },
    upperInner: { x: 4, y: -1 },
    lowerInner: { x: 4, y: 1 },
  };
}

describe("eyeAspectRatio", () => {
  it("solves the hand built open eye to exactly one third", () => {
    expect(eyeAspectRatio(openEye())).toBeCloseTo(1 / 3, 10);
  });

  it("collapses to zero for a fully closed eye", () => {
    const eye = openEye();
    eye.upperOuter = { x: 2, y: 0 };
    eye.lowerOuter = { x: 2, y: 0 };
    eye.upperInner = { x: 4, y: 0 };
    eye.lowerInner = { x: 4, y: 0 };
    expect(eyeAspectRatio(eye)).toBe(0);
  });

  it("halves when the lids come half way down", () => {
    const eye = openEye();
    eye.upperOuter = { x: 2, y: -0.5 };
    eye.lowerOuter = { x: 2, y: 0.5 };
    eye.upperInner = { x: 4, y: -0.5 };
    eye.lowerInner = { x: 4, y: 0.5 };
    expect(eyeAspectRatio(eye)).toBeCloseTo(1 / 6, 10);
  });

  it("does not change when the whole eye scales, the ratio is unit free", () => {
    const eye = openEye();
    const scaled: EyeLandmarks = {
      outerCorner: { x: 0, y: 0 },
      innerCorner: { x: 12, y: 0 },
      upperOuter: { x: 4, y: -2 },
      lowerOuter: { x: 4, y: 2 },
      upperInner: { x: 8, y: -2 },
      lowerInner: { x: 8, y: 2 },
    };
    expect(eyeAspectRatio(scaled)).toBeCloseTo(eyeAspectRatio(eye) ?? -1, 10);
  });

  it("returns null when the corners coincide instead of dividing by zero", () => {
    const eye = openEye();
    eye.innerCorner = { x: 0, y: 0 };
    expect(eyeAspectRatio(eye)).toBeNull();
  });
});

describe("EAR index maps", () => {
  it("draw only from their own eye's contour set", () => {
    const right = new Set(RIGHT_EYE_INDICES);
    const left = new Set(LEFT_EYE_INDICES);
    for (const index of Object.values(RIGHT_EYE_EAR_INDICES)) {
      expect(right.has(index)).toBe(true);
    }
    for (const index of Object.values(LEFT_EYE_EAR_INDICES)) {
      expect(left.has(index)).toBe(true);
    }
  });
});

describe("EAR against the recorded fixture", () => {
  const session = loadSession01();

  it("yields a sane ratio on every one of the 300 real frames", () => {
    let bad = 0;
    for (const frame of session.frames) {
      const eye = eyeLandmarksFromFace(
        frameLandmarks(frame),
        RIGHT_EYE_EAR_INDICES,
      );
      const ear = eye === null ? null : eyeAspectRatio(eye);
      if (ear === null || ear < 0 || ear > 1) {
        bad += 1;
      }
    }
    expect(bad).toBe(0);
  });

  it("contains the recorded blinks: the minimum dives well under the median", () => {
    const ears: number[] = [];
    for (const frame of session.frames) {
      const eye = eyeLandmarksFromFace(
        frameLandmarks(frame),
        RIGHT_EYE_EAR_INDICES,
      );
      const ear = eye === null ? null : eyeAspectRatio(eye);
      if (ear !== null) {
        ears.push(ear);
      }
    }
    const sorted = [...ears].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const minimum = sorted[0] ?? 1;
    expect(minimum).toBeLessThan(median * 0.5);
  });
});
