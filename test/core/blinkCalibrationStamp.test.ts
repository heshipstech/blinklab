import { describe, expect, it } from "vitest";

import {
  POSE_APERTURE_SPAN_PERCENT,
  conditionsMismatch,
  guidedCalibrationMetadataRows,
  separationRatio,
} from "../../src/core/blinkCalibrationStamp";
import { parseBlinkCalibration } from "../../src/core/guidedCalibration";

// Roadmap 10.13a, ladder A8. A stored line without the conditions it
// was measured under cannot be judged, and a stored line nobody can
// judge is one the detector uses anyway.

const STAMP = {
  cameraLabel: "a webcam",
  frameWidthPx: 1280,
  frameHeightPx: 720,
  irisWidthPx: 40,
  recordedAtIso: "2026-09-07T00:00:00.000Z",
};

const STORED = {
  personalLineMm: 3.4,
  openMedianMm: 7,
  closedMedianMm: 1.8,
  openSampleCount: 90,
  closedSampleCount: 45,
  stamp: STAMP,
};

describe("the separation the line came from", () => {
  it("is how far the closed median sits below the open one", () => {
    // 1 - 1.8/7. The number the resolver's own gate is expressed in,
    // so an export can be checked against the rule that produced it.
    expect(separationRatio(7, 1.8)).toBeCloseTo(0.742857, 6);
  });

  it("refuses an open median of nothing rather than dividing by it", () => {
    expect(separationRatio(0, 1.8)).toBeNull();
  });
});

describe("the conditions flag", () => {
  it("says nothing when the live camera matches the stamp", () => {
    expect(conditionsMismatch(STAMP, 1280, 720, 40)).toBeNull();
  });

  it("flags a different frame size at all, however small", () => {
    // A different capture size is a different pixel grid, not a
    // smaller version of the same one, so there is no margin to be
    // inside of.
    expect(conditionsMismatch(STAMP, 640, 480, 40)).toBe("frame-size");
    expect(conditionsMismatch(STAMP, 1280, 721, 40)).toBe("frame-size");
  });

  it("tolerates an iris difference smaller than the pose span", () => {
    // The margin is not invented. The validity gate already accepts
    // head angles across which the published millimetre swings
    // POSE_APERTURE_SPAN_PERCENT (docs/pose-aperture-bias.txt, roadmap
    // 10.10c4c). A condition change that moves the scale by LESS than
    // an error the instrument already tolerates is not worth a flag.
    const inside = 40 * (1 + (POSE_APERTURE_SPAN_PERCENT - 1) / 100);
    expect(conditionsMismatch(STAMP, 1280, 720, inside)).toBeNull();
  });

  it("flags an iris difference larger than the pose span", () => {
    const outside = 40 * (1 + (POSE_APERTURE_SPAN_PERCENT + 1) / 100);
    expect(conditionsMismatch(STAMP, 1280, 720, outside)).toBe("iris-width");
  });

  it("flags a shrunken iris as readily as a grown one", () => {
    // Distance moves in both directions and the scale error does too.
    const outside = 40 / (1 + (POSE_APERTURE_SPAN_PERCENT + 1) / 100);
    expect(conditionsMismatch(STAMP, 1280, 720, outside)).toBe("iris-width");
  });

  it("says nothing when the live iris cannot be measured", () => {
    // No ruler this frame is not evidence that the conditions changed.
    expect(conditionsMismatch(STAMP, 1280, 720, null)).toBeNull();
  });

  it("names the frame size first when both differ", () => {
    // One flag, deterministically chosen, so the export does not
    // depend on which check ran first.
    expect(conditionsMismatch(STAMP, 640, 480, 10)).toBe("frame-size");
  });
});

describe("the metadata rows a guided session carries", () => {
  it("writes the line, both medians, both counts and the separation", () => {
    const rows = guidedCalibrationMetadataRows(STORED, null);
    expect(rows).toEqual([
      "# guided_line_mm: 3.4",
      "# guided_open_median_mm: 7",
      "# guided_closed_median_mm: 1.8",
      "# guided_open_samples: 90",
      "# guided_closed_samples: 45",
      "# guided_separation_ratio: 0.743",
      "# guided_camera: a webcam",
      "# guided_frame_size: 1280x720",
      "# guided_iris_width_px: 40.0",
      "# guided_recorded_at: 2026-09-07T00:00:00.000Z",
      "# guided_conditions_match: true",
    ]);
  });

  it("says which condition differs rather than only that one does", () => {
    const rows = guidedCalibrationMetadataRows(STORED, "iris-width");
    expect(rows).toContain("# guided_conditions_match: false (iris-width)");
    expect(rows).not.toContain("# guided_conditions_match: true");
  });

  it("writes nothing at all when no guided line is in force", () => {
    // Not a block of "none" rows. A passive session did not measure
    // these, and rows saying so would invite a reader to compare them.
    expect(guidedCalibrationMetadataRows(null, null)).toEqual([]);
  });

  it("names an unknown camera rather than omitting the row", () => {
    const rows = guidedCalibrationMetadataRows(
      { ...STORED, stamp: { ...STAMP, cameraLabel: null } },
      null,
    );
    expect(rows).toContain("# guided_camera: unknown");
  });
});

describe("the stored shape, still parsed strictly", () => {
  it("refuses an entry written before the conditions were stamped", () => {
    // Deliberate. A line whose conditions nobody recorded cannot be
    // checked against the camera in front of it, and the whole reason
    // this row exists is that such a line was used anyway. The cost is
    // that a person who calibrated before today calibrates again, once.
    const old = JSON.stringify({
      personalLineMm: 3.4,
      openMedianMm: 7,
      closedMedianMm: 1.8,
    });
    expect(parseBlinkCalibration(old)).toBeNull();
  });

  it("accepts a fully stamped entry", () => {
    expect(parseBlinkCalibration(JSON.stringify(STORED))).toEqual(STORED);
  });

  it("refuses a stamp with a frame size that is not a size", () => {
    const bad = { ...STORED, stamp: { ...STAMP, frameWidthPx: 0 } };
    expect(parseBlinkCalibration(JSON.stringify(bad))).toBeNull();
  });

  it("refuses a stamp with no recording time", () => {
    const bad = { ...STORED, stamp: { ...STAMP, recordedAtIso: "" } };
    expect(parseBlinkCalibration(JSON.stringify(bad))).toBeNull();
  });

  it("refuses counts that claim fewer samples than the resolver needs", () => {
    const bad = { ...STORED, openSampleCount: 0 };
    expect(parseBlinkCalibration(JSON.stringify(bad))).toBeNull();
  });
});
