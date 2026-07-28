import { describe, expect, it } from "vitest";

import { applyTransform, frameTransform } from "../../src/core/transform";

describe("frameTransform", () => {
  it("is the identity when not mirrored", () => {
    expect(frameTransform(false, 640)).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
  });

  it("flips horizontally around the frame width when mirrored", () => {
    expect(frameTransform(true, 640)).toEqual({
      a: -1,
      b: 0,
      c: 0,
      d: 1,
      e: 640,
      f: 0,
    });
  });
});

describe("applyTransform", () => {
  it("maps the left edge to the right edge under mirroring", () => {
    const mirror = frameTransform(true, 640);
    expect(applyTransform(mirror, { x: 0, y: 100 })).toEqual({
      x: 640,
      y: 100,
    });
  });

  it("keeps the centre column exactly where it is", () => {
    const mirror = frameTransform(true, 640);
    expect(applyTransform(mirror, { x: 320, y: 50 })).toEqual({
      x: 320,
      y: 50,
    });
  });

  it("returns the original point when mirrored twice", () => {
    const mirror = frameTransform(true, 640);
    const point = { x: 123, y: 456 };
    expect(applyTransform(mirror, applyTransform(mirror, point))).toEqual(
      point,
    );
  });

  it("leaves any point untouched under the identity", () => {
    const identity = frameTransform(false, 640);
    expect(applyTransform(identity, { x: 12, y: 34 })).toEqual({
      x: 12,
      y: 34,
    });
  });
});
