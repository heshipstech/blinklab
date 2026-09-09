import { describe, expect, it } from "vitest";

import type { Point2 } from "../../src/core/geometry";
import {
  LUMINANCE_THUMBNAIL_HEIGHT,
  LUMINANCE_THUMBNAIL_WIDTH,
  faceBox,
} from "../../src/core/sceneLuminance";

// Roadmap 12.16b, the pure half of the wiring. Where the face is,
// inside a raster of a given size, from normalised landmarks.
//
// Landmarks arrive normalised, so this needs no camera resolution at
// all: a face spanning x from 0.3 to 0.7 covers the same FRACTION of
// any raster it is drawn into. That is what lets the scene and the
// face be read from ONE small thumbnail rather than two full-size
// pixel reads, which is the difference between about nine kilobytes a
// second and about eight megabytes.

/** A ring of landmarks with known normalised bounds. */
function corners(
  left: number,
  top: number,
  right: number,
  bottom: number,
): Point2[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: (left + right) / 2, y: (top + bottom) / 2 },
  ];
}

describe("boxing the face inside a raster", () => {
  it("maps normalised bounds onto the raster", () => {
    expect(faceBox(corners(0.25, 0.5, 0.75, 1), 64, 36)).toEqual({
      x: 16,
      y: 18,
      width: 32,
      height: 18,
    });
  });

  it("needs no camera resolution, only the raster it lands in", () => {
    // The property that makes one thumbnail enough. The same face
    // covers the same fraction of a 64-wide raster and a 128-wide
    // one, so nothing has to know how big the camera frame was.
    const face = corners(0.25, 0.25, 0.75, 0.75);
    const small = faceBox(face, 64, 64);
    const large = faceBox(face, 128, 128);
    expect(small).toEqual({ x: 16, y: 16, width: 32, height: 32 });
    expect(large).toEqual({ x: 32, y: 32, width: 64, height: 64 });
  });

  it("rounds outward, so the box never excludes a landmark", () => {
    // Rounding inward would crop the very rim the face was measured
    // by, and on a small raster that is a whole pixel of a face that
    // is only a few pixels across.
    const box = faceBox(corners(0.11, 0.11, 0.19, 0.19), 64, 36);
    expect(box).not.toBeNull();
    expect(box?.x).toBe(7);
    expect(box?.y).toBe(3);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThanOrEqual(
      Math.ceil(0.19 * 64),
    );
  });

  it("clamps a face that runs off the raster", () => {
    // A face at the edge of the frame is ordinary, not an error. The
    // box shrinks to what is actually there.
    const box = faceBox(corners(-0.2, -0.2, 0.5, 0.5), 64, 36);
    expect(box).toEqual({ x: 0, y: 0, width: 32, height: 18 });
  });

  it("refuses a face entirely off the raster", () => {
    expect(faceBox(corners(1.2, 1.2, 1.5, 1.5), 64, 36)).toBeNull();
    expect(faceBox(corners(-1.5, -1.5, -1.2, -1.2), 64, 36)).toBeNull();
  });

  it("refuses when there are no landmarks", () => {
    expect(faceBox([], 64, 36)).toBeNull();
  });

  it("refuses a landmark that is not a number", () => {
    expect(
      faceBox(
        [{ x: Number.NaN, y: 0.5 }, ...corners(0.2, 0.2, 0.4, 0.4)],
        64,
        36,
      ),
    ).toBeNull();
  });

  it("refuses a raster with no area", () => {
    expect(faceBox(corners(0.2, 0.2, 0.4, 0.4), 0, 36)).toBeNull();
    expect(faceBox(corners(0.2, 0.2, 0.4, 0.4), 64, 0)).toBeNull();
  });

  it("refuses a face that rounds away to nothing", () => {
    // A face a thousandth of the frame wide is under one pixel of a
    // 64-wide thumbnail. Reporting a zero-width box would hand
    // luminanceField an empty crop; reporting nothing says what is
    // true, which is that this raster cannot see the face.
    expect(faceBox(corners(0.5, 0.5, 0.5, 0.5), 64, 36)).toBeNull();
  });
});

describe("the thumbnail the whole row rests on", () => {
  it("is small enough to read every second without noticing", () => {
    // 64 by 36 is 2304 pixels, about nine kilobytes of RGBA. A
    // full-resolution read of a 1080p frame is about eight megabytes,
    // which is why the scene is downscaled by the browser before it
    // is read rather than after.
    expect(LUMINANCE_THUMBNAIL_WIDTH).toBe(64);
    expect(LUMINANCE_THUMBNAIL_HEIGHT).toBe(36);
  });

  it("is big enough for a face to land on more than a handful", () => {
    // A face covering a quarter of the frame in each direction lands
    // on 16 by 9 pixels here. Averaging fewer than that would make
    // the face figure jump on one bright pixel.
    const box = faceBox(corners(0.375, 0.375, 0.625, 0.625), 64, 36);
    expect((box?.width ?? 0) * (box?.height ?? 0)).toBeGreaterThanOrEqual(100);
  });
});
