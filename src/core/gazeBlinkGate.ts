import { MAX_BLINK_DURATION_MS } from "./constants";
import type { IrisOffset } from "./gazeOffset";

// Blinks out of the gaze chain (roadmap 14.9b, audit A25/C9). During
// a blink the iris is occluded, the landmark model's iris centre
// dives with the lid, and the resulting "offset" is a fake glance:
// it splits fixations, spills into the heatmap's dwell, and can flip
// the on-screen column — all from an eye that never moved. The two
// rules here take the blink out at one gate, so every consumer of
// the offset (the quadrant readout, the on-screen column, the
// smoother, the fixation buffer, the heatmap) sees one truth.

/**
 * The bound under which a null gap in the gaze signal reads as a
 * blink rather than a lost face. Aliased, not invented: the blink
 * detector refuses closures past MAX_BLINK_DURATION_MS as "no longer
 * a blink", and the long-closure detector draws its own threshold at
 * the same constant, so a gap at or under it is lid, not absence.
 */
export const GAZE_GAP_BRIDGE_MS = MAX_BLINK_DURATION_MS;

/**
 * The offset, unless the lid is below the blink line — then null,
 * because a covered iris is not a gaze measurement and null means
 * not measured, never zero. Strictly below, matching the blink
 * detector's own boundary (blink.ts counts closed as apertureMm <
 * thresholdMm): this gate may not disagree with the detector about
 * where a blink begins. An unmeasured aperture or an absent line
 * keeps the offset — refusing to invent a blink is the same stance
 * as refusing to invent a glance.
 */
export function offsetAboveBlinkLine(
  offset: IrisOffset | null,
  apertureMm: number | null,
  blinkLineMm: number | null,
): IrisOffset | null {
  if (offset === null || apertureMm === null || blinkLineMm === null) {
    return offset;
  }
  return apertureMm < blinkLineMm ? null : offset;
}

/**
 * Whether a null gap clears the fixation buffer. A blink-length gap
 * bridges — the eye did not move, the lid covered it, and I-DT's
 * dispersion box decides across the hole whether the stillness held.
 * A longer gap is a lost face, and bridging one would be an invented
 * stillness, the exact honesty the old clear-on-any-gap rule
 * protected; that rule just could not tell a lid from an absence.
 * Exactly at the bound still bridges, the blink detector's own
 * inclusive duration test (closedDurationMs <= MAX_BLINK_DURATION_MS
 * is still a blink).
 */
export function gapClearsGazeBuffer(
  gapMs: number,
  bridgeMs: number = GAZE_GAP_BRIDGE_MS,
): boolean {
  return gapMs > bridgeMs;
}
