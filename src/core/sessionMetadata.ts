import type { FeatureRecord } from "./featureRecord";
import { percentile } from "./statistics";

// What the conditions of a measurement were, written into the export
// beside the measurement itself.
//
// Until 15 August a camera session's export said `source: camera` and
// almost nothing else: `duration_seconds` and `measured_fps` were only
// ever filled in for clips, so a live session carried no rate at all
// and no word about the camera that produced it. Six exports from six
// people would have been six anonymous columns of millimetres with no
// way to tell a full-frame mirrorless at 60 fps from a 480p laptop cam
// in a dim room.
//
// A measurement without its conditions is not a measurement, it is a
// number. This module turns the conditions into the same `# key: value`
// rows the source, coverage and KSS metadata already use.
//
// Everything here is pure. Reading the browser for a DeviceInfo lives
// in io/deviceInfo.ts, so the sentence-building can be tested without
// a camera, which is the only way these strings ever get checked.

/** What the browser can tell us about the camera and the machine. */
export type DeviceInfo = {
  /** The camera's own name, e.g. "FaceTime HD Camera". */
  cameraLabel: string | null;
  /** Negotiated capture size, which is not always what was asked for. */
  cameraWidthPx: number | null;
  cameraHeightPx: number | null;
  /**
   * The rate the CAMERA says it is configured to deliver.
   *
   * This is the number the page has never had. The on-screen processing
   * rate is the browser's animation pace, so a 15 fps camera behind a
   * 60 Hz display reads about 60 and the 25 fps blink gate stays open.
   * Remediation D1 is about wiring a true rate into that gate; this
   * records the camera's own claim so the blast radius of doing so can
   * be measured on real hardware before it ships.
   */
  cameraDeclaredFps: number | null;
  /** "user" or "environment". Only meaningful on a phone. */
  facingMode: string | null;
  userAgent: string | null;
  hardwareConcurrency: number | null;
  viewportWidthPx: number | null;
  viewportHeightPx: number | null;
  screenWidthPx: number | null;
  screenHeightPx: number | null;
  devicePixelRatio: number | null;
  orientation: string | null;
};

/**
 * A moment the person marked during the session.
 *
 * The reason this exists is a flaw in the six-person validation
 * protocol it was built for. That protocol asks for ten deliberate
 * blinks, so that ten is known ground truth. Finding those ten in the
 * export means looking for a burst of ten detections, which fails
 * exactly when the instrument MISSED them, which is the case worth
 * measuring. Using the instrument's output to locate the event that
 * tests the instrument is circular. A marker breaks the circle: the
 * truth is "ten blinks between marker 1 and marker 2", whatever the
 * instrument thought.
 */
/** The frame the face model actually read, which display size never changes. */
export type MeasurementFrame = {
  widthPx: number;
  heightPx: number;
};

export type SessionMarker = {
  atMs: number;
  index: number;
};

/**
 * The iris width sample cap, following BLINK_LOG_RECORD_CAP's precedent
 * rather than inventing a second convention. A three minute session at
 * 60 frames per second is about 10,800 samples, so this does not bind
 * in practice, and the metadata says so out loud when it does.
 */
export const IRIS_SAMPLE_CAP = 20000;

function line(key: string, value: string | number | null): string {
  return `# ${key}: ${value === null ? "unknown" : value}`;
}

/** The camera and machine rows. Every field says "unknown" rather than vanishing. */
export function deviceMetadataRows(info: DeviceInfo | null): string[] {
  if (info === null) {
    // A clip run has no camera. Saying so beats omitting the block and
    // leaving a reader to wonder whether it was dropped or never existed.
    return [line("camera", "none, not a camera session")];
  }
  const size =
    info.cameraWidthPx === null || info.cameraHeightPx === null
      ? null
      : `${info.cameraWidthPx}x${info.cameraHeightPx}`;
  const viewport =
    info.viewportWidthPx === null || info.viewportHeightPx === null
      ? null
      : `${info.viewportWidthPx}x${info.viewportHeightPx}`;
  const screen =
    info.screenWidthPx === null || info.screenHeightPx === null
      ? null
      : `${info.screenWidthPx}x${info.screenHeightPx}`;
  return [
    line("camera", info.cameraLabel),
    line("camera_resolution", size),
    line("camera_declared_fps", info.cameraDeclaredFps),
    line("facing_mode", info.facingMode),
    line("user_agent", info.userAgent),
    line("hardware_concurrency", info.hardwareConcurrency),
    line("viewport", viewport),
    line("screen", screen),
    line("device_pixel_ratio", info.devicePixelRatio),
    line("orientation", info.orientation),
  ];
}

/** The median of a sample, or null when there is nothing to take a median of. */
export function medianIrisWidthPx(samples: readonly number[]): number | null {
  const usable = samples.filter((value) => Number.isFinite(value) && value > 0);
  return usable.length === 0 ? null : percentile(usable, 50);
}

/** The share of records that carried a usable face, 0 to 1, or null when empty. */
export function faceDetectedFraction(
  records: readonly FeatureRecord[],
): number | null {
  if (records.length === 0) {
    return null;
  }
  const seen = records.filter((record) => record.faceDetected).length;
  return seen / records.length;
}

/** Wall-clock span of the session from its own records, in seconds. */
export function observedDurationSeconds(
  records: readonly FeatureRecord[],
): number | null {
  const first = records[0];
  const last = records[records.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  const spanMs = last.timestampMs - first.timestampMs;
  return spanMs > 0 ? spanMs / 1000 : null;
}

/**
 * The conditions the session itself reveals, as opposed to the ones the
 * device declared. A camera session had none of this before.
 */
export function sessionMetadataRows(
  records: readonly FeatureRecord[],
  irisWidths: readonly number[],
  markers: readonly SessionMarker[],
  visibilityChanges: number,
  measurementFrame: MeasurementFrame | null,
): string[] {
  const duration = observedDurationSeconds(records);
  const median = medianIrisWidthPx(irisWidths);
  const detected = faceDetectedFraction(records);
  const rows = [
    line(
      "observed_duration_seconds",
      duration === null ? null : duration.toFixed(3),
    ),
    line("records", records.length),
    line(
      "face_detected_fraction",
      detected === null ? null : detected.toFixed(3),
    ),
    // The frame the MODEL read, which is not the canvas the page draws.
    // The canvas is capped at 640 wide for display and the landmarker
    // is handed the video element itself, so an iris width expressed in
    // canvas pixels understates the real resolution by exactly the
    // display scale. It said "px" without saying whose, which made the
    // one field that lets two devices be compared the field most likely
    // to mislead. Both numbers travel together now.
    line(
      "measurement_frame",
      measurementFrame === null
        ? null
        : `${measurementFrame.widthPx}x${measurementFrame.heightPx}`,
    ),
    // The measurement's own resolution, in the pixels of the frame
    // above. The iris is the ruler every millimetre on the page is
    // divided by, so how many pixels it spans sets the precision of all
    // of them. Aperture itself is a RATIO of iris pixels to lid pixels,
    // so it survives any display scale; this number does not, which is
    // why it is pinned to a stated frame.
    line("median_iris_width_px", median === null ? null : median.toFixed(1)),
    line("visibility_changes", visibilityChanges),
  ];
  if (irisWidths.length >= IRIS_SAMPLE_CAP) {
    // The blink log's WARNING precedent: a truncated record says so in
    // the file rather than looking complete.
    rows.push(
      line(
        "median_iris_width_note",
        `computed over the first ${IRIS_SAMPLE_CAP} frames, later frames not sampled`,
      ),
    );
  }
  rows.push(line("markers", markers.length));
  for (const marker of markers) {
    rows.push(
      line(`marker_${marker.index}_seconds`, (marker.atMs / 1000).toFixed(3)),
    );
  }
  return rows;
}
