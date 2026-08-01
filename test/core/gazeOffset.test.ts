import { describe, expect, it } from "vitest";

import {
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_CENTER_INDEX,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
} from "../../src/core/constants";
import { irisOffset } from "../../src/core/gazeOffset";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";
import { EYE_WIDTH_MM, syntheticFace } from "../fixtures/syntheticFace";

const W = 1000;
const H = 1000;

function bothOffsets(options: Parameters<typeof syntheticFace>[0]) {
  const face = syntheticFace(options);
  return {
    right: irisOffset(
      face,
      RIGHT_EYE_EAR_INDICES,
      RIGHT_IRIS_CENTER_INDEX,
      "right",
      W,
      H,
    ),
    left: irisOffset(
      face,
      LEFT_EYE_EAR_INDICES,
      LEFT_IRIS_CENTER_INDEX,
      "left",
      W,
      H,
    ),
  };
}

describe("irisOffset at known synthetic offsets", () => {
  it("reads a 3 mm rightward shift as exactly 0.1 of the eye width, both eyes", () => {
    const { right, left } = bothOffsets({
      distanceMm: 500,
      irisShiftMm: { xMm: 3, yMm: 0 },
    });
    expect(right?.horizontal).toBeCloseTo(3 / EYE_WIDTH_MM, 8);
    expect(left?.horizontal).toBeCloseTo(3 / EYE_WIDTH_MM, 8);
    expect(right?.vertical).toBeCloseTo(0, 8);
    expect(left?.vertical).toBeCloseTo(0, 8);
  });

  it("reads a leftward shift as negative", () => {
    const { right, left } = bothOffsets({
      distanceMm: 500,
      irisShiftMm: { xMm: -3, yMm: 0 },
    });
    expect(right?.horizontal).toBeCloseTo(-0.1, 8);
    expect(left?.horizontal).toBeCloseTo(-0.1, 8);
  });

  it("reads a downward shift on the vertical axis only", () => {
    const { right } = bothOffsets({
      distanceMm: 500,
      irisShiftMm: { xMm: 0, yMm: 2 },
    });
    expect(right?.vertical).toBeCloseTo(2 / EYE_WIDTH_MM, 8);
    expect(right?.horizontal).toBeCloseTo(0, 8);
  });

  it("reads centred irises as zero, at any distance", () => {
    for (const distanceMm of [400, 800]) {
      const { right, left } = bothOffsets({ distanceMm });
      expect(right?.horizontal).toBeCloseTo(0, 8);
      expect(right?.vertical).toBeCloseTo(0, 8);
      expect(left?.horizontal).toBeCloseTo(0, 8);
      expect(left?.vertical).toBeCloseTo(0, 8);
    }
  });

  it("survives a 15 degree roll untouched, the projection is the point", () => {
    const level = bothOffsets({
      distanceMm: 500,
      irisShiftMm: { xMm: 3, yMm: 0 },
    });
    const rolled = bothOffsets({
      distanceMm: 500,
      irisShiftMm: { xMm: 3, yMm: 0 },
      rollDeg: 15,
    });
    expect(rolled.right?.horizontal).toBeCloseTo(
      level.right?.horizontal ?? -1,
      8,
    );
    expect(rolled.right?.vertical).toBeCloseTo(level.right?.vertical ?? -1, 8);
  });

  it("returns null on degenerate corners or missing landmarks", () => {
    expect(
      irisOffset(
        [],
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_CENTER_INDEX,
        "right",
        W,
        H,
      ),
    ).toBeNull();
    const collapsed = syntheticFace({ distanceMm: 500 });
    const inner = collapsed[RIGHT_EYE_EAR_INDICES.innerCorner];
    if (inner !== undefined) {
      collapsed[RIGHT_EYE_EAR_INDICES.outerCorner] = { ...inner };
    }
    expect(
      irisOffset(
        collapsed,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_CENTER_INDEX,
        "right",
        W,
        H,
      ),
    ).toBeNull();
  });
});

describe("irisOffset against the recorded fixture", () => {
  it("stays in a sane range across all 300 real frames", () => {
    const session = loadSession01();
    let outOfRange = 0;
    for (const frame of session.frames) {
      const face = frameLandmarks(frame);
      const offset = irisOffset(
        face,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_CENTER_INDEX,
        "right",
        1280,
        720,
      );
      if (
        offset === null ||
        Math.abs(offset.horizontal) > 0.5 ||
        Math.abs(offset.vertical) > 0.5
      ) {
        outOfRange += 1;
      }
    }
    expect(outOfRange).toBe(0);
  });
});
