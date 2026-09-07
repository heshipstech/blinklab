import { IRIS_DIAMETER_MM } from "./constants";
import { FIXTURE_COORDINATE_QUANTUM } from "./fixtureRecording";
import { type Point2 } from "./geometry";
import { percentile } from "./statistics";

// What the fixture's stored precision is worth in millimetres.
// Roadmap 10.10c4e, ladder B12, audit F-094. The prediction was
// written before any of this existed and lives in
// docs/fixture-storage-quantum.txt.
//
// docs/aperture-noise-floor.txt publishes this instrument's stillness
// figure, a median frame-to-frame aperture change of about 0.02 mm,
// measured over the 300 committed frames of the recorded fixture.
// Every millimetre-scale judgement in this project is read against
// that floor.
//
// The fixture does not store what the landmarker produced. It stores
// each coordinate rounded to FIXTURE_COORDINATE_QUANTUM of a
// normalised image coordinate, to keep the file to a fifth of its
// full-precision size. So part of the measured wobble is the eye and
// part is the grid the numbers were written onto, and until this row
// the published floor did not say how much is which.
//
// The same arrangement as velocityBias.ts and poseBias.ts next door: a
// pure calculation whose numbers a test recomputes from the committed
// fixture, so the figure published in prose cannot drift from the
// arithmetic that produced it.

/** One stored rounding step, in pixels, on each axis of a frame. */
export type CoordinateStepPx = {
  /** Normalised x is a fraction of the frame WIDTH. */
  horizontalPx: number;
  /** Normalised y is a fraction of the frame HEIGHT. */
  verticalPx: number;
};

/**
 * The stored grid in pixels at one frame size.
 *
 * The two axes are not the same size. Normalised x spans the width and
 * y the height, so on a 16:9 frame one rounding step is nearly twice
 * as many pixels horizontally as vertically, and which of them matters
 * depends on which way the measured chord runs.
 */
export function coordinateStepPx(
  frameWidthPx: number,
  frameHeightPx: number,
): CoordinateStepPx {
  return {
    horizontalPx: FIXTURE_COORDINATE_QUANTUM * frameWidthPx,
    verticalPx: FIXTURE_COORDINATE_QUANTUM * frameHeightPx,
  };
}

/**
 * The tilt of a chord away from vertical, in degrees, 0 to 90.
 *
 * In PIXELS, never in normalised coordinates: a chord equal in
 * normalised x and y is not at 45 degrees on a frame that is not
 * square, and mixing the axes before converting is the trap
 * aperture.ts warns about at the top.
 *
 * Null for a chord of no length, because a point has no direction and
 * an invented angle would be indistinguishable from a measured one.
 */
export function chordTiltFromVerticalDeg(
  upper: Point2,
  lower: Point2,
  frameWidthPx: number,
  frameHeightPx: number,
): number | null {
  const dx = Math.abs(upper.x - lower.x) * frameWidthPx;
  const dy = Math.abs(upper.y - lower.y) * frameHeightPx;
  if (dx === 0 && dy === 0) {
    return null;
  }
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * The tilt past which the horizontal grid moves a chord's length more
 * than the vertical grid does.
 *
 * A chord's length changes by sin(tilt) of a horizontal step plus
 * cos(tilt) of a vertical one, so the crossover is arctan of their
 * ratio. Below it the finer vertical grid is what the aperture rides,
 * which is the first thing this row set out to check rather than
 * assume.
 */
export function tiltWhereHorizontalDominatesDeg(
  step: CoordinateStepPx,
): number {
  return (Math.atan2(step.verticalPx, step.horizontalPx) * 180) / Math.PI;
}

/**
 * What one stored step is worth in aperture millimetres.
 *
 * Half a step, because the published aperture is the MEAN of two lid
 * chords and a step on one chord's endpoint moves that mean by half of
 * it. Then through the instrument's own ruler: pixels times
 * IRIS_DIAMETER_MM over the iris width the fixture actually shows,
 * measured rather than assumed.
 *
 * Null for an iris of no width, the same refusal apertureMm makes: no
 * ruler, no millimetre.
 */
export function apertureStorageQuantumMm(
  verticalStepPx: number,
  irisWidthPx: number,
): number | null {
  if (irisWidthPx <= 0) {
    return null;
  }
  return (verticalStepPx / 2) * (IRIS_DIAMETER_MM / irisWidthPx);
}

export type StorageQuantum = {
  horizontalStepPx: number;
  verticalStepPx: number;
  medianIrisWidthPx: number;
  medianTiltDeg: number;
  apertureQuantumMm: number;
};

/**
 * The whole figure from a fixture's own measurements.
 *
 * Takes the per-frame iris widths and lid-chord tilts rather than
 * reading the file, because core does not read disks; the test feeds
 * it what the instrument's own functions measured over the committed
 * frames. Null when there is nothing to take a median of, since a
 * quantum computed over zero frames is not a small quantum.
 */
export function storageQuantum(
  irisWidthsPx: readonly number[],
  tiltsDeg: readonly number[],
  frameWidthPx: number,
  frameHeightPx: number,
): StorageQuantum | null {
  const medianIrisWidthPx = percentile(irisWidthsPx, 50);
  const medianTiltDeg = percentile(tiltsDeg, 50);
  if (medianIrisWidthPx === null || medianTiltDeg === null) {
    return null;
  }
  const step = coordinateStepPx(frameWidthPx, frameHeightPx);
  const apertureQuantumMm = apertureStorageQuantumMm(
    step.verticalPx,
    medianIrisWidthPx,
  );
  if (apertureQuantumMm === null) {
    return null;
  }
  return {
    horizontalStepPx: step.horizontalPx,
    verticalStepPx: step.verticalPx,
    medianIrisWidthPx,
    medianTiltDeg,
    apertureQuantumMm,
  };
}
