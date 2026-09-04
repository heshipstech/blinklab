import { describe, expect, it } from "vitest";

import { IRIS_DIAMETER_MM } from "../../src/core/constants";
import type { Point2 } from "../../src/core/geometry";
import { pupilDiameterMm, type LuminanceField } from "../../src/core/pupil";

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
