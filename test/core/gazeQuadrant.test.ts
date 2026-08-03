import { describe, expect, it } from "vitest";

import {
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_CENTER_INDEX,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
} from "../../src/core/constants";
import { irisOffset } from "../../src/core/gazeOffset";
import {
  meanIrisOffset,
  screenQuadrant,
  type ScreenQuadrant,
} from "../../src/core/gazeQuadrant";
import { syntheticFace } from "../fixtures/syntheticFace";

const W = 1000;
const H = 1000;

// Labelled fixture frames: each synthetic gaze shift carries the
// quadrant a human at the screen would name. Looking toward the
// screen's left turns the irises toward the subject's left, which is
// IMAGE RIGHT unmirrored, hence positive horizontal means screen left.
const LABELLED: {
  shift: { xMm: number; yMm: number };
  label: ScreenQuadrant;
}[] = [
  { shift: { xMm: 3, yMm: -2 }, label: "top left" },
  { shift: { xMm: -3, yMm: -2 }, label: "top right" },
  { shift: { xMm: 3, yMm: 2 }, label: "bottom left" },
  { shift: { xMm: -3, yMm: 2 }, label: "bottom right" },
  { shift: { xMm: 1, yMm: -0.5 }, label: "top left" },
  { shift: { xMm: -1, yMm: 0.5 }, label: "bottom right" },
];

function classify(shift: { xMm: number; yMm: number }): ScreenQuadrant | null {
  const face = syntheticFace({ distanceMm: 500, irisShiftMm: shift });
  const mean = meanIrisOffset(
    irisOffset(
      face,
      RIGHT_EYE_EAR_INDICES,
      RIGHT_IRIS_CENTER_INDEX,
      "right",
      W,
      H,
    ),
    irisOffset(
      face,
      LEFT_EYE_EAR_INDICES,
      LEFT_IRIS_CENTER_INDEX,
      "left",
      W,
      H,
    ),
  );
  return mean === null ? null : screenQuadrant(mean);
}

describe("screenQuadrant on labelled synthetic frames", () => {
  it("names every labelled gaze correctly", () => {
    for (const { shift, label } of LABELLED) {
      expect(classify(shift)).toBe(label);
    }
  });

  it("runs the boundary convention at exactly zero: left and bottom win", () => {
    expect(screenQuadrant({ horizontal: 0, vertical: 0 })).toBe("bottom left");
    expect(screenQuadrant({ horizontal: 0.001, vertical: -0.001 })).toBe(
      "top left",
    );
    expect(screenQuadrant({ horizontal: -0.001, vertical: 0.001 })).toBe(
      "bottom right",
    );
  });
});

describe("meanIrisOffset", () => {
  it("averages both eyes componentwise", () => {
    expect(
      meanIrisOffset(
        { horizontal: 0.1, vertical: -0.04 },
        { horizontal: 0.06, vertical: 0 },
      ),
    ).toEqual({ horizontal: 0.08, vertical: -0.02 });
  });

  it("is null when either eye is null, one eyed gaze is not trusted", () => {
    expect(meanIrisOffset(null, { horizontal: 0, vertical: 0 })).toBeNull();
    expect(meanIrisOffset({ horizontal: 0, vertical: 0 }, null)).toBeNull();
  });
});
