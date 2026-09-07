import type { StoredBlinkCalibration } from "./guidedCalibration";

// The conditions a stored blink line was measured under, and whether
// the camera in front of the person still matches them. Roadmap
// 10.13a, ladder A8, audit F-007 and G-Guided b-11.
//
// A stored guided line overrides the passive baseline for as long as
// it exists, and until this row it was three bare numbers: a line and
// the two medians it came from. Nothing said which camera measured
// it, at what size, how far away, or when. A line nobody can judge is
// one the detector uses anyway, which is the shape of every defect
// this ladder item names.
//
// The stamp does not make the line WRONG when it stops matching. The
// millimetre is computed through each frame's own iris ruler, so the
// line stays in the same units whatever the distance. What changes is
// how much the reader should trust the comparison, and that is a thing
// to say in the export rather than a thing to decide silently.

/**
 * The percentage span of the published millimetre across head angles
 * the validity gate already accepts.
 *
 * From `poseBiasSpan()` (src/core/poseBias.ts, roadmap 10.10c4c): the
 * aperture reads 6.03 percent low at the gate's 20 degrees of pitch
 * and 10.34 percent high at its 25 of yaw. Stated here rather than
 * computed, because computing it would drag a 125-pose simulation into
 * the browser bundle; a test holds this number to that simulation, so
 * it cannot drift from what produced it.
 *
 * It is the margin below because it is the honest one. The instrument
 * already tolerates this much scale error from head angle alone, and a
 * condition change that moves the scale by LESS than an error the
 * instrument already accepts is not worth a flag. One larger than it
 * is.
 */
export const POSE_APERTURE_SPAN_PERCENT = 16.369;

/** Which condition stopped matching, or null when they all still do. */
export type ConditionsMismatch = "frame-size" | "iris-width";

/**
 * How far the closed median sat below the open one, 0 to 1.
 *
 * The quantity the resolver's own separation gate is expressed in
 * (GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION), so a reader can check
 * an exported line against the rule that admitted it. Null for an open
 * median of nothing, rather than a division by it.
 */
export function separationRatio(
  openMedianMm: number,
  closedMedianMm: number,
): number | null {
  return openMedianMm > 0 ? 1 - closedMedianMm / openMedianMm : null;
}

/**
 * Whether the live camera still matches the stamp.
 *
 * Frame size has no margin: a different capture size is a different
 * pixel grid, not a smaller version of the same one.
 *
 * Iris width has one, because it moves continuously with how far the
 * person is sitting from the camera and a person shifts in their seat.
 * The margin is POSE_APERTURE_SPAN_PERCENT above, in both directions.
 *
 * A live frame with no measurable iris returns null: no ruler this
 * frame is not evidence that the conditions changed, and flagging on
 * it would make the flag mean "the face moved" rather than "the setup
 * differs".
 */
export function conditionsMismatch(
  stamp: StoredBlinkCalibration["stamp"],
  liveWidthPx: number,
  liveHeightPx: number,
  liveIrisWidthPx: number | null,
): ConditionsMismatch | null {
  if (
    liveWidthPx !== stamp.frameWidthPx ||
    liveHeightPx !== stamp.frameHeightPx
  ) {
    return "frame-size";
  }
  if (liveIrisWidthPx === null || stamp.irisWidthPx === null) {
    // Nothing to compare. A frame with no ruler, or a line stored
    // without one, is not evidence that the conditions changed.
    return null;
  }
  const ratio = liveIrisWidthPx / stamp.irisWidthPx;
  const margin = POSE_APERTURE_SPAN_PERCENT / 100;
  return ratio > 1 + margin || ratio < 1 / (1 + margin) ? "iris-width" : null;
}

function line(key: string, value: string | number): string {
  return `# ${key}: ${String(value)}`;
}

/**
 * The metadata block a guided session carries, or nothing at all.
 *
 * Nothing, rather than a block of "none" rows, when no guided line is
 * in force: a passive session did not measure these, and rows saying
 * so would invite a reader to compare them across sessions that never
 * held the same thing.
 */
export function guidedCalibrationMetadataRows(
  stored: StoredBlinkCalibration | null,
  mismatch: ConditionsMismatch | null,
): string[] {
  if (stored === null) {
    return [];
  }
  const separation = separationRatio(
    stored.openMedianMm,
    stored.closedMedianMm,
  );
  return [
    line("guided_line_mm", stored.personalLineMm),
    line("guided_open_median_mm", stored.openMedianMm),
    line("guided_closed_median_mm", stored.closedMedianMm),
    line("guided_open_samples", stored.openSampleCount),
    line("guided_closed_samples", stored.closedSampleCount),
    line(
      "guided_separation_ratio",
      separation === null ? "unknown" : separation.toFixed(3),
    ),
    line("guided_camera", stored.stamp.cameraLabel ?? "unknown"),
    line(
      "guided_frame_size",
      `${String(stored.stamp.frameWidthPx)}x${String(stored.stamp.frameHeightPx)}`,
    ),
    line(
      "guided_iris_width_px",
      stored.stamp.irisWidthPx === null
        ? "unknown"
        : stored.stamp.irisWidthPx.toFixed(1),
    ),
    line("guided_recorded_at", stored.stamp.recordedAtIso),
    line(
      "guided_conditions_match",
      mismatch === null ? "true" : `false (${mismatch})`,
    ),
  ];
}
