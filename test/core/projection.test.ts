import { describe, expect, it } from "vitest";

import { projectNormalizedPoint } from "../../src/core/projection";
import { frameTransform } from "../../src/core/transform";
import { sampleNormalizedLandmarks } from "../fixtures/sampleLandmarks";

const WIDTH = 640;
const HEIGHT = 360;

describe("projectNormalizedPoint", () => {
  it("maps the fixture through an unmirrored 640 x 360 canvas", () => {
    const identity = frameTransform(false, WIDTH);
    const projected = sampleNormalizedLandmarks.map((p) =>
      projectNormalizedPoint(p, WIDTH, HEIGHT, identity),
    );
    expect(projected).toEqual([
      { x: 0, y: 0 },
      { x: 640, y: 360 },
      { x: 320, y: 180 },
      { x: 160, y: 270 },
    ]);
  });

  it("maps the fixture through a mirrored canvas, x flips, y stays", () => {
    const mirror = frameTransform(true, WIDTH);
    const projected = sampleNormalizedLandmarks.map((p) =>
      projectNormalizedPoint(p, WIDTH, HEIGHT, mirror),
    );
    expect(projected).toEqual([
      { x: 640, y: 0 },
      { x: 0, y: 360 },
      { x: 320, y: 180 },
      { x: 480, y: 270 },
    ]);
  });

  it("keeps every in range fixture point inside the canvas either way", () => {
    for (const mirrored of [false, true]) {
      const transform = frameTransform(mirrored, WIDTH);
      for (const p of sampleNormalizedLandmarks) {
        const projected = projectNormalizedPoint(p, WIDTH, HEIGHT, transform);
        expect(projected.x).toBeGreaterThanOrEqual(0);
        expect(projected.x).toBeLessThanOrEqual(WIDTH);
        expect(projected.y).toBeGreaterThanOrEqual(0);
        expect(projected.y).toBeLessThanOrEqual(HEIGHT);
      }
    }
  });
});
