import { type LuminanceField, pupilDiameterMm } from "./pupil";

// Roadmap 13.11. How many iris pixels does the pupil estimator
// actually need?
//
// The light-response experiment resolved the pupil in 1 of 239
// in-window seconds, and the result page named the 43 px median webcam
// iris as the suspected limit. Suspected: nobody had measured what the
// estimator needs, and row 13.12 cannot be armed against a floor
// nobody has established. The prediction was committed before any of
// this existed, in docs/pupil-resolution-floor.txt.
//
// MODEL-DERIVED, and the label is not modesty. A dark disc on a bright
// annulus has no lashes, no lid, no specular highlight, no sensor
// noise and no motion. What a floor measured here gives is a LOWER
// BOUND on what a real eye needs, and the distance between that bound
// and reality is the whole reason 13.12 waits for optics rather than
// for arithmetic.

/** The luminances the synthetic eye is built from. */
export const SYNTHETIC_PUPIL_LUMINANCE = 0.1;
export const SYNTHETIC_IRIS_LUMINANCE = 0.6;

/**
 * How much of the iris the pupil covers, as a fraction of iris
 * DIAMETER, in the sweep's default eye.
 *
 * 0.4 is an ordinary indoor pupil: the estimator's own physiological
 * band runs from 0.16 to 1.7 of the iris diameter, and 0.4 sits
 * comfortably inside it rather than at an edge where the band itself
 * would be what fails.
 */
export const SYNTHETIC_PUPIL_FRACTION = 0.4;

/**
 * A synthetic eye: a dark pupil disc on a bright iris, then blurred.
 *
 * The raster is larger than the iris so that rays cast to the full
 * iris radius stay inside the field; a ray running off the edge is
 * refused by the estimator for a reason that has nothing to do with
 * resolution, which would make the sweep measure the wrong thing.
 *
 * The blur is a separable Gaussian, clamped at the edges. It stands in
 * for everything that softens a real edge — optics, sensor, the
 * scaler — as one number, which is honest about it being a stand-in
 * rather than a model of any particular lens.
 */
export function syntheticEye(
  irisWidthPx: number,
  blurPx: number,
  pupilFraction = SYNTHETIC_PUPIL_FRACTION,
): LuminanceField | null {
  if (
    !Number.isFinite(irisWidthPx) ||
    !Number.isFinite(blurPx) ||
    irisWidthPx < 2 ||
    blurPx < 0 ||
    pupilFraction <= 0 ||
    pupilFraction >= 1
  ) {
    return null;
  }
  const size = Math.max(3, Math.round(irisWidthPx * 1.2));
  const centre = (size - 1) / 2;
  const pupilRadius = (pupilFraction * irisWidthPx) / 2;
  const sharp: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      sharp.push(
        Math.hypot(x - centre, y - centre) <= pupilRadius
          ? SYNTHETIC_PUPIL_LUMINANCE
          : SYNTHETIC_IRIS_LUMINANCE,
      );
    }
  }
  return { samples: blur(sharp, size, blurPx), width: size, height: size };
}

/** A separable Gaussian, edges clamped. */
function blur(
  samples: readonly number[],
  size: number,
  sigma: number,
): number[] {
  if (sigma <= 0) {
    return [...samples];
  }
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel: number[] = [];
  let total = 0;
  for (let k = -radius; k <= radius; k++) {
    const weight = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel.push(weight);
    total += weight;
  }
  const normalised = kernel.map((w) => w / total);
  const at = (row: readonly number[], i: number): number =>
    row[Math.min(row.length - 1, Math.max(0, i))] ?? 0;

  const horizontal: number[] = new Array<number>(samples.length).fill(0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const clamped = Math.min(size - 1, Math.max(0, x + k));
        sum +=
          (normalised[k + radius] ?? 0) * (samples[y * size + clamped] ?? 0);
      }
      horizontal[y * size + x] = sum;
    }
  }
  const out: number[] = new Array<number>(samples.length).fill(0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const clamped = Math.min(size - 1, Math.max(0, y + k));
        sum +=
          (normalised[k + radius] ?? 0) * at(horizontal, clamped * size + x);
      }
      out[y * size + x] = sum;
    }
  }
  return out;
}

/** Whether the estimator resolves a pupil in a synthetic eye of this size. */
export function resolvesAt(
  irisWidthPx: number,
  blurPx: number,
  pupilFraction = SYNTHETIC_PUPIL_FRACTION,
): boolean {
  const field = syntheticEye(irisWidthPx, blurPx, pupilFraction);
  if (field === null) {
    return false;
  }
  const centre = (field.width - 1) / 2;
  return (
    pupilDiameterMm(field, { x: centre, y: centre }, irisWidthPx / 2) !== null
  );
}

/**
 * The smallest width in `widths` at which the estimator resolves, or
 * null when it never does.
 *
 * The widths are scanned in order and the FIRST success is returned,
 * which is only the floor if success is monotone in width. That is
 * asserted by a test rather than assumed here, because a
 * non-monotone estimator would make "the floor" a meaningless phrase
 * and the sweep would be quietly reporting the first of several
 * islands.
 */
export function resolutionFloor(
  widths: readonly number[],
  blurPx: number,
  pupilFraction = SYNTHETIC_PUPIL_FRACTION,
): number | null {
  for (const width of widths) {
    if (resolvesAt(width, blurPx, pupilFraction)) {
      return width;
    }
  }
  return null;
}

/**
 * The widths and blurs the committed sweep covers.
 *
 * Widths run down to 2 px deliberately, past where a synthetic eye is
 * still an eye, because a sweep whose smallest entry is its answer has
 * measured its own grid rather than the estimator. The first run of
 * this stopped at 8 px and reported 8, which was the edge and not the
 * floor.
 */
export const SWEEP_WIDTHS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 43,
];

/** Blur in pixels, as the one stand-in for everything that softens an edge. */
export const SWEEP_BLURS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4];

/**
 * Below this width the sweep is measuring geometry, not the estimator.
 *
 * At three pixels of iris the pupil is 1.2 px across: there is no disc
 * to find, and the answer flips on where the raster's centre lands
 * rather than on anything the estimator does. Measured rather than
 * assumed — two pixels resolves, three does not, four does — and the
 * non-monotone pair is pinned by its own test so this number cannot be
 * quietly raised to hide a real island.
 */
export const SWEEP_MIN_MEANINGFUL_WIDTH_PX = 4;

/**
 * The sweep as a CSV, one row per iris width, one column per blur.
 *
 * Written to a committed file and compared back digit for digit, the
 * same arrangement the verdict fixtures use: a table typed by hand is
 * somebody's idea of what the sweep says.
 */
export function sweepCsv(): string {
  const header = [
    "irisWidthPx",
    ...SWEEP_BLURS.map((b) => `blur${String(b)}px`),
  ];
  const rows = SWEEP_WIDTHS.map((width) =>
    [
      String(width),
      ...SWEEP_BLURS.map((blur) => (resolvesAt(width, blur) ? "1" : "0")),
    ].join(","),
  );
  return [header.join(","), ...rows, ""].join("\n");
}
