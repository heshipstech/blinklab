import { describe, expect, it } from "vitest";

import type { FeatureRecord } from "../../src/core/featureRecord";
import {
  IRIS_SAMPLE_CAP,
  deviceMetadataRows,
  faceDetectedFraction,
  medianIrisWidthPx,
  observedDurationSeconds,
  sessionMetadataRows,
  type DeviceInfo,
  type MeasurementFrame,
} from "../../src/core/sessionMetadata";

// A camera session's export used to carry no rate and no word about the
// camera: duration_seconds and measured_fps were only ever filled in
// for clips. Six exports from six strangers would have been six
// anonymous columns of millimetres, with no way to tell a full-frame
// mirrorless at 60 fps from a 480p laptop camera in a dim room.
//
// A measurement without its conditions is not a measurement.

const FULL: DeviceInfo = {
  cameraLabel: "FaceTime HD Camera",
  cameraWidthPx: 1280,
  cameraHeightPx: 720,
  cameraDeclaredFps: 30,
  facingMode: "user",
  userAgent: "Mozilla/5.0 (Macintosh)",
  hardwareConcurrency: 10,
  viewportWidthPx: 1512,
  viewportHeightPx: 945,
  screenWidthPx: 1512,
  screenHeightPx: 982,
  devicePixelRatio: 2,
  orientation: "landscape-primary",
};

const EMPTY: DeviceInfo = {
  cameraLabel: null,
  cameraWidthPx: null,
  cameraHeightPx: null,
  cameraDeclaredFps: null,
  facingMode: null,
  userAgent: null,
  hardwareConcurrency: null,
  viewportWidthPx: null,
  viewportHeightPx: null,
  screenWidthPx: null,
  screenHeightPx: null,
  devicePixelRatio: null,
  orientation: null,
};

function record(timestampMs: number, faceDetected: boolean): FeatureRecord {
  return {
    timestampMs,
    faceDetected,
    fps: 60,
    apertureMm: null,
    baselineMm: null,
    shutBaselineMm: null,
    blinkRatePerMin: null,
    lastBlinkDurationMs: null,
    lastBlinkAmplitudeMm: null,
    lastBlinkPeakVelocityMmPerS: null,
    perclos: null,
    longClosureCount: 0,
    fixationCount: 0,
    fixationMedianMs: null,
    fixating: false,
    onScreen: null,
  };
}

describe("device rows", () => {
  it("records the camera's own declared rate, which the page has never had", () => {
    // The on-screen processing rate is the browser's animation pace, so
    // a 15 fps camera behind a 60 Hz display reads about 60 and the
    // 25 fps blink gate stays open. This is the camera's own claim.
    expect(deviceMetadataRows(FULL)).toContain("# camera_declared_fps: 30");
  });

  it("writes the resolution and the machine, not an identifier", () => {
    const rows = deviceMetadataRows(FULL).join("\n");
    expect(rows).toContain("# camera: FaceTime HD Camera");
    expect(rows).toContain("# camera_resolution: 1280x720");
    expect(rows).toContain("# facing_mode: user");
    expect(rows).toContain("# hardware_concurrency: 10");
    // deviceId is a stable per-origin identifier for one camera, which
    // is a fingerprint rather than a measurement. It is not collected,
    // so it cannot appear.
    expect(rows).not.toContain("deviceId");
    expect(rows).not.toContain("device_id");
  });

  it("says unknown rather than dropping a field the browser withheld", () => {
    const rows = deviceMetadataRows(EMPTY);
    // A missing row is indistinguishable from a field nobody thought
    // of. "unknown" is a true statement; absence is a gap.
    expect(rows).toHaveLength(deviceMetadataRows(FULL).length);
    expect(rows.every((row) => row.startsWith("# "))).toBe(true);
    expect(
      rows.filter((row) => row.endsWith(": unknown")).length,
    ).toBeGreaterThan(5);
  });

  it("says so plainly when there was no camera at all", () => {
    expect(deviceMetadataRows(null)[0]).toContain("not a camera session");
  });
});

describe("what the session itself reveals", () => {
  it("takes the duration from timestamps, never from row count", () => {
    expect(
      observedDurationSeconds([record(1000, true), record(4000, true)]),
    ).toBe(3);
    expect(observedDurationSeconds([])).toBeNull();
    expect(observedDurationSeconds([record(1000, true)])).toBeNull();
  });

  it("reports the share of records that saw a face", () => {
    expect(
      faceDetectedFraction([
        record(0, true),
        record(1000, false),
        record(2000, true),
        record(3000, true),
      ]),
    ).toBe(0.75);
    expect(faceDetectedFraction([])).toBeNull();
  });

  it("takes a median iris width and ignores impossible samples", () => {
    expect(medianIrisWidthPx([10, 20, 30])).toBe(20);
    // A zero or a NaN is not a narrow iris, it is a failed measurement,
    // and averaging it in would quietly pull the ruler's stated
    // resolution downward.
    expect(medianIrisWidthPx([0, 20, Number.NaN, 30, 40])).toBe(30);
    expect(medianIrisWidthPx([])).toBeNull();
    expect(medianIrisWidthPx([0, 0])).toBeNull();
  });
});

describe("session rows", () => {
  const records = [record(0, true), record(1000, true), record(2000, false)];
  const FRAME: MeasurementFrame = { widthPx: 1920, heightPx: 1080 };

  it("carries the numbers that make two devices comparable", () => {
    const rows = sessionMetadataRows(records, [30, 40, 50], [], 0, FRAME).join(
      "\n",
    );
    expect(rows).toContain("# observed_duration_seconds: 2.000");
    expect(rows).toContain("# records: 3");
    expect(rows).toContain("# face_detected_fraction: 0.667");
    // The iris is the ruler every millimetre is divided by, so its
    // width in pixels IS the resolution of the measurement.
    expect(rows).toContain("# median_iris_width_px: 40.0");
    expect(rows).toContain("# visibility_changes: 0");
  });

  it("writes each marker, because the marker is the ground truth", () => {
    const rows = sessionMetadataRows(
      records,
      [30],
      [
        { atMs: 42000, index: 1 },
        { atMs: 55500, index: 2 },
      ],
      0,
      FRAME,
    ).join("\n");
    expect(rows).toContain("# markers: 2");
    expect(rows).toContain("# marker_1_seconds: 42.000");
    expect(rows).toContain("# marker_2_seconds: 55.500");
  });

  it("admits when the iris sample was truncated", () => {
    // The blink log's WARNING precedent: a truncated record says so in
    // the file rather than looking complete. Without this the median
    // would silently describe the opening stretch of a long session.
    const capped = new Array(IRIS_SAMPLE_CAP).fill(30) as number[];
    const rows = sessionMetadataRows(records, capped, [], 0, FRAME).join("\n");
    expect(rows).toContain("median_iris_width_note");
    expect(rows).toContain("not sampled");
    expect(
      sessionMetadataRows(records, [30], [], 0, FRAME).join("\n"),
    ).not.toContain("median_iris_width_note");
  });

  it("pins the iris width to the frame the model actually read", () => {
    // The defect this closes: the number was measured in 640-wide
    // canvas pixels while the model reads the video element, so it
    // understated the real resolution by exactly the display scale and
    // said "px" without saying whose. It misled its own author within a
    // day of being added.
    const rows = sessionMetadataRows(records, [26], [], 0, FRAME).join("\n");
    expect(rows).toContain("# measurement_frame: 1920x1080");
    expect(rows).toContain("# median_iris_width_px: 26.0");
  });

  it("says the frame is unknown rather than guessing at the canvas", () => {
    expect(
      sessionMetadataRows(records, [26], [], 0, null).join("\n"),
    ).toContain("# measurement_frame: unknown");
  });

  it("survives a session that recorded nothing", () => {
    const rows = sessionMetadataRows([], [], [], 0, null).join("\n");
    expect(rows).toContain("# observed_duration_seconds: unknown");
    expect(rows).toContain("# records: 0");
    expect(rows).toContain("# median_iris_width_px: unknown");
  });
});
