import { describe, expect, it } from "vitest";

import type { LuminanceField } from "../../src/core/pupil";
import { LUMINANCE_LABEL, meanLuminance } from "../../src/core/sceneLuminance";

// Roadmap 12.16a. How much light the camera thinks it is seeing, as a
// number, with no adjective attached to it.
//
// This is the parked ambient-light idea, and it is parked for a good
// reason: nothing here knows what a lux is. A webcam applies its own
// automatic exposure and white balance before this project sees a
// single byte, so a bright room and a dim room the camera has
// compensated for can arrive looking alike. What the number measures
// is the camera's rendering of the light, which is a real, repeatable
// quantity about the picture and NOT a measurement of the room.
//
// So the measurement half lands and the verdict half does not. No
// "too dark", no "well lit", no threshold, until something has been
// measured against an outcome. Row 13.6b is where the light joins the
// capability ladder, and it waits on this.

/** A field of one repeated value: the evenly lit room. */
function flat(value: number, width = 4, height = 4): LuminanceField {
  return {
    samples: Array.from({ length: width * height }, () => value),
    width,
    height,
  };
}

describe("the mean of a field", () => {
  it("reads a dark frame low", () => {
    expect(meanLuminance(flat(0.05))).toBeCloseTo(0.05, 10);
  });

  it("reads a bright frame high", () => {
    expect(meanLuminance(flat(0.9))).toBeCloseTo(0.9, 10);
  });

  it("averages an unevenly lit frame", () => {
    // The spotlight, which is the case that makes TWO regions worth
    // exporting rather than one: a lamp on the face leaves most of the
    // frame dark, so a whole-frame mean and a face mean disagree, and
    // the disagreement is the fact worth recording.
    const scene: LuminanceField = {
      samples: [0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1],
      width: 4,
      height: 3,
    };
    const face = flat(0.9, 2, 1);
    expect(meanLuminance(scene)).toBeCloseTo((0.1 * 10 + 0.9 * 2) / 12, 10);
    expect(meanLuminance(face)).toBeCloseTo(0.9, 10);
    // The point of the pair, stated as an assertion rather than left
    // to a reader: the face is lit and the scene is not.
    expect(meanLuminance(face) ?? 0).toBeGreaterThan(
      (meanLuminance(scene) ?? 1) * 2,
    );
  });
});

describe("black is a measurement and broken is not", () => {
  it("reads a fully black frame as zero, not as nothing", () => {
    // A lens cap is a real reading. It has to be distinguishable from
    // a read that failed, or the export cannot tell a dark room from
    // a dropped frame, and the whole blank-not-zero discipline
    // collapses at the source rather than at the serializer.
    expect(meanLuminance(flat(0))).toBe(0);
  });

  it("reads a failed field as nothing, not as zero", () => {
    expect(meanLuminance(null)).toBeNull();
  });

  it("keeps those two apart", () => {
    expect(meanLuminance(flat(0))).not.toBeNull();
    expect(meanLuminance(null)).not.toBe(0);
  });
});

describe("fields that are not fields", () => {
  it("refuses one with no samples", () => {
    expect(meanLuminance({ samples: [], width: 0, height: 0 })).toBeNull();
  });

  it("refuses one whose samples do not fill its grid", () => {
    // The malformed case that matters, because it is the one a wrong
    // crop produces: the dimensions say one thing and the array says
    // another, and averaging anyway would publish a number for a
    // region nobody read.
    expect(
      meanLuminance({ samples: [0.5, 0.5, 0.5], width: 2, height: 2 }),
    ).toBeNull();
  });

  it("refuses one with a sample that is not a number", () => {
    expect(
      meanLuminance({ samples: [0.5, Number.NaN], width: 2, height: 1 }),
    ).toBeNull();
    expect(
      meanLuminance({
        samples: [0.5, Number.POSITIVE_INFINITY],
        width: 2,
        height: 1,
      }),
    ).toBeNull();
  });

  it("refuses one with a sample outside the range luminance lives in", () => {
    // luminanceField produces [0,1] by construction, so a value
    // outside it means the field came from somewhere else, and a mean
    // over it would not be a luminance at all.
    expect(
      meanLuminance({ samples: [0.5, 1.5], width: 2, height: 1 }),
    ).toBeNull();
    expect(
      meanLuminance({ samples: [0.5, -0.1], width: 2, height: 1 }),
    ).toBeNull();
  });

  it("refuses a negative or non-integer grid", () => {
    expect(meanLuminance({ samples: [0.5], width: -1, height: 1 })).toBeNull();
    expect(meanLuminance({ samples: [0.5], width: 1.5, height: 1 })).toBeNull();
  });
});

describe("the label, which is the other half of this row", () => {
  it("says what the number is of", () => {
    expect(LUMINANCE_LABEL).toContain("camera");
    expect(LUMINANCE_LABEL).toContain("light");
  });

  it("says what it is not", () => {
    expect(LUMINANCE_LABEL).toContain("lux");
  });

  it("carries no verdict", () => {
    // The parked half. Until something is measured against an
    // outcome, this number gets no adjective: not dark, not bright,
    // not poor, not good, not enough.
    for (const verdict of [
      "too dark",
      "too bright",
      "well lit",
      "poor",
      "good",
      "enough",
      "insufficient",
    ]) {
      expect(LUMINANCE_LABEL.toLowerCase()).not.toContain(verdict);
    }
  });
});
