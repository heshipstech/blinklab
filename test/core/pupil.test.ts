import { describe, expect, it } from "vitest";

import { IRIS_DIAMETER_MM } from "../../src/core/constants";
import type { Point2 } from "../../src/core/geometry";
import {
  luminanceField,
  pupilDiameterMm,
  type LuminanceField,
  type PixelBox,
} from "../../src/core/pupil";

// A square luminance field from a per-pixel function, values in [0, 1].
function fieldFrom(
  size: number,
  luminance: (x: number, y: number) => number,
): LuminanceField {
  const samples: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      samples.push(luminance(x, y));
    }
  }
  return { samples, width: size, height: size };
}

// A dark pupil disc of the given radius on a mid-grey iris.
function discField(
  size: number,
  centre: Point2,
  pupilRadius: number,
  dark = 0.1,
  iris = 0.6,
): LuminanceField {
  return fieldFrom(size, (x, y) =>
    Math.hypot(x - centre.x, y - centre.y) <= pupilRadius ? dark : iris,
  );
}

const CENTRE: Point2 = { x: 50, y: 50 };
const IRIS_RADIUS = 45;

describe("pupilDiameterMm", () => {
  it("recovers a known pupil diameter through the iris ruler", () => {
    // Pupil radius 15 against iris radius 45: ratio 1/3, so the diameter
    // is one third of 11.7 mm = 3.9 mm.
    const field = discField(101, CENTRE, 15);
    const mm = pupilDiameterMm(field, CENTRE, IRIS_RADIUS);
    expect(mm).not.toBeNull();
    expect(mm as number).toBeCloseTo((15 / 45) * IRIS_DIAMETER_MM, 0);
  });

  it("tracks a larger pupil to a larger diameter", () => {
    const small = pupilDiameterMm(
      discField(101, CENTRE, 12),
      CENTRE,
      IRIS_RADIUS,
    );
    const large = pupilDiameterMm(
      discField(101, CENTRE, 24),
      CENTRE,
      IRIS_RADIUS,
    );
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(large as number).toBeGreaterThan((small as number) + 2);
  });

  it("refuses a flat field with no dark centre", () => {
    const field = fieldFrom(101, () => 0.6);
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses when the centre-to-rim contrast is too low", () => {
    // A centre only 0.05 below the iris is under the contrast floor.
    const field = discField(101, CENTRE, 15, 0.55, 0.6);
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses a dark region that nearly fills the iris", () => {
    const field = discField(101, CENTRE, 43);
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses a dark speck too small to be a pupil", () => {
    const field = discField(101, CENTRE, 2);
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses an occluded pupil that never reaches the iris on some rays", () => {
    // A dark wedge to the left, dark all the way to the rim, so the rays
    // pointing into it never cross: more than a quarter of them fail.
    const field = fieldFrom(101, (x, y) => {
      const d = Math.hypot(x - CENTRE.x, y - CENTRE.y);
      let diff = Math.abs(Math.atan2(y - CENTRE.y, x - CENTRE.x) - Math.PI);
      if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
      }
      return d <= 15 || diff < 1.0 ? 0.1 : 0.6;
    });
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses a strongly non-circular dark region", () => {
    // An eccentric ellipse: the rays disagree on the radius past the
    // spread the estimator will accept.
    const rx = 8;
    const ry = 30;
    const field = fieldFrom(101, (x, y) => {
      const dx = (x - CENTRE.x) / rx;
      const dy = (y - CENTRE.y) / ry;
      return dx * dx + dy * dy <= 1 ? 0.1 : 0.6;
    });
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses a malformed field whose samples do not fill it", () => {
    const field: LuminanceField = { samples: [0.1, 0.2], width: 5, height: 5 };
    expect(pupilDiameterMm(field, CENTRE, IRIS_RADIUS)).toBeNull();
  });

  it("refuses an empty field and a non-positive iris radius", () => {
    expect(
      pupilDiameterMm(
        { samples: [], width: 0, height: 0 },
        CENTRE,
        IRIS_RADIUS,
      ),
    ).toBeNull();
    expect(pupilDiameterMm(discField(101, CENTRE, 15), CENTRE, 0)).toBeNull();
  });

  it("refuses when the iris centre falls outside the field", () => {
    const field = discField(101, CENTRE, 15);
    expect(pupilDiameterMm(field, { x: 200, y: 200 }, IRIS_RADIUS)).toBeNull();
  });

  it("refuses when the rim reference falls entirely off the field", () => {
    // Centre in-bounds but the iris radius reaches far beyond the field,
    // so every rim sample is off it and there is no bright reference.
    const field = fieldFrom(11, () => 0.3);
    expect(pupilDiameterMm(field, { x: 5, y: 5 }, 100)).toBeNull();
  });
});

// A square RGBA frame from a per-pixel luminance function in [0, 1],
// written to all three channels with an opaque alpha.
function rgbaFrom(
  size: number,
  luminance: (x: number, y: number) => number,
): number[] {
  const rgba: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.round(luminance(x, y) * 255);
      rgba.push(value, value, value, 255);
    }
  }
  return rgba;
}

const WHOLE = (size: number): PixelBox => ({
  x: 0,
  y: 0,
  width: size,
  height: size,
});

describe("luminanceField", () => {
  it("converts RGBA to Rec. 601 luminance in [0, 1]", () => {
    // One white and one red pixel, side by side.
    const rgba = [255, 255, 255, 255, 255, 0, 0, 255];
    const field = luminanceField(rgba, 2, 1, {
      x: 0,
      y: 0,
      width: 2,
      height: 1,
    });
    expect(field).not.toBeNull();
    const samples = (field as LuminanceField).samples;
    expect(samples[0]).toBeCloseTo(1, 5);
    expect(samples[1]).toBeCloseTo(0.299, 3);
  });

  it("crops to the requested box", () => {
    // A 3x3 frame that is white only at (2, 2); cropping the bottom-right
    // 2x2 keeps that corner.
    const rgba = rgbaFrom(3, (x, y) => (x === 2 && y === 2 ? 1 : 0));
    const field = luminanceField(rgba, 3, 3, {
      x: 1,
      y: 1,
      width: 2,
      height: 2,
    });
    expect(field).not.toBeNull();
    const f = field as LuminanceField;
    expect(f.width).toBe(2);
    expect(f.height).toBe(2);
    expect(f.samples[3]).toBeCloseTo(1, 5); // the (2,2) corner, last cell
    expect(f.samples[0]).toBeCloseTo(0, 5);
  });

  it("feeds the pupil estimator end to end from raw pixels", () => {
    // A dark pupil disc drawn in RGBA, cropped whole, recovers its
    // diameter through the same iris ruler as the grid-level test.
    const centre = { x: 50, y: 50 };
    const rgba = rgbaFrom(101, (x, y) =>
      Math.hypot(x - centre.x, y - centre.y) <= 15 ? 0.1 : 0.6,
    );
    const field = luminanceField(rgba, 101, 101, WHOLE(101));
    expect(field).not.toBeNull();
    const mm = pupilDiameterMm(field as LuminanceField, centre, 45);
    expect(mm).not.toBeNull();
    expect(mm as number).toBeCloseTo((15 / 45) * IRIS_DIAMETER_MM, 0);
  });

  it("fills undefined pixels with zero rather than failing", () => {
    // A sparse array of the right length: every pixel a hole. The field
    // is all zero, not a refusal, so a missing byte reads as black.
    const sparse: number[] = [];
    sparse.length = 2 * 2 * 4;
    const field = luminanceField(sparse, 2, 2, WHOLE(2));
    expect(field).not.toBeNull();
    expect((field as LuminanceField).samples).toEqual([0, 0, 0, 0]);
  });

  it("refuses a pixel array that does not match the frame size", () => {
    expect(luminanceField([0, 0, 0, 255], 4, 4, WHOLE(4))).toBeNull();
  });

  it("refuses an empty frame, an empty box, and a box off the frame", () => {
    const rgba = rgbaFrom(4, () => 0.5);
    expect(luminanceField([], 0, 0, WHOLE(4))).toBeNull();
    expect(
      luminanceField(rgba, 4, 4, { x: 0, y: 0, width: 0, height: 4 }),
    ).toBeNull();
    expect(
      luminanceField(rgba, 4, 4, { x: 2, y: 2, width: 4, height: 4 }),
    ).toBeNull();
  });
});
