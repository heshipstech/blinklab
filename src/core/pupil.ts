import { IRIS_DIAMETER_MM } from "./constants";
import type { Point2 } from "./geometry";
import { percentile } from "./statistics";

// Pupil diameter from the eye image, through the same ruler the aperture
// uses: the iris is 11.7 mm across in nearly everyone, so the pupil's
// size relative to the iris IS its size in millimetres, with no new
// calibration. The hard part is not the arithmetic, it is deciding
// whether there is a pupil to measure at all: a webcam in a bright room
// may show no dark centre, a blink or a lash may occlude it, and a
// confident number over an eye the instrument cannot actually see is
// exactly the kind of guess this project refuses. So this estimator
// returns null far more readily than it returns a number, and every
// gate below is a documented reason it might.

// The eye region as a grid of luminance samples, row-major, each in
// [0, 1] where 0 is black and 1 is white. The io layer produces this
// from the canvas; core never touches a pixel, only these numbers.
export type LuminanceField = {
  readonly samples: readonly number[];
  readonly width: number;
  readonly height: number;
};

// Rays cast outward from the iris centre. Sixteen directions is enough
// to median over and to notice an asymmetric (occluded) pupil; forty
// steps along each gives sub-pixel crossing resolution on a small eye.
const RAY_COUNT = 16;
const STEPS_PER_RAY = 40;

// The pupil edge is where luminance climbs halfway from the dark centre
// to the bright iris. The bright reference is read near the iris rim
// (0.9 of the radius, inside it) so a lid touching the very edge does
// not poison it.
const EDGE_FRACTION = 0.5;
const EDGE_REFERENCE_RADIUS = 0.9;

// Below this centre-to-rim contrast there is no dark centre to find:
// a flat, evenly lit eye returns null rather than a number off noise.
const MIN_CONTRAST = 0.12;

// If more than a quarter of the rays never reach the bright iris within
// the iris radius, the dark region is not a bounded pupil -- a blink, a
// lash, a shadow down one side -- and the estimate is refused.
const MAX_UNCROSSED_FRACTION = 0.25;

// The rays should agree on the radius. A spread (inter-quartile over
// median) past this means no clean circular edge was found.
const MAX_SPREAD_RATIO = 0.5;

// Physiology bounds the plausible pupil: 2-8 mm against an 11.7 mm iris
// is a radius ratio of roughly 0.17 to 0.68. A generous band around
// that rejects a "pupil" that is a speck of noise or nearly the whole
// iris, both of which mean the detection failed rather than succeeded.
const MIN_PUPIL_IRIS_RATIO = 0.08;
const MAX_PUPIL_IRIS_RATIO = 0.85;

// Bilinear luminance at a fractional point, or null when the point falls
// outside the field. The length is validated by the caller, so an
// in-bounds index is always present.
function sampleAt(field: LuminanceField, x: number, y: number): number | null {
  const { samples, width, height } = field;
  if (!(x >= 0 && y >= 0 && x <= width - 1 && y <= height - 1)) {
    return null;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const at = (ix: number, iy: number) => samples[iy * width + ix] ?? 0;
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
  return top * (1 - fy) + bottom * fy;
}

function rayAngles(): number[] {
  const angles: number[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    angles.push((2 * Math.PI * i) / RAY_COUNT);
  }
  return angles;
}

/**
 * The pupil diameter in millimetres, or null when the eye image does
 * not support a trustworthy estimate. `irisCentre` and `irisRadiusPx`
 * are in the field's own pixel coordinates; the iris diameter
 * (2 * irisRadiusPx) is the 11.7 mm ruler, so the pupil's diameter is
 * its radius as a fraction of the iris radius, times 11.7.
 */
export function pupilDiameterMm(
  field: LuminanceField,
  irisCentre: Point2,
  irisRadiusPx: number,
): number | null {
  if (field.width <= 0 || field.height <= 0) {
    return null;
  }
  if (field.samples.length !== field.width * field.height) {
    return null;
  }
  if (irisRadiusPx <= 0) {
    return null;
  }

  const centre = sampleAt(field, irisCentre.x, irisCentre.y);
  if (centre === null) {
    return null;
  }

  const angles = rayAngles();

  const rim: number[] = [];
  for (const angle of angles) {
    const x =
      irisCentre.x + Math.cos(angle) * irisRadiusPx * EDGE_REFERENCE_RADIUS;
    const y =
      irisCentre.y + Math.sin(angle) * irisRadiusPx * EDGE_REFERENCE_RADIUS;
    const luminance = sampleAt(field, x, y);
    if (luminance !== null) {
      rim.push(luminance);
    }
  }
  const edge = percentile(rim, 50);
  if (edge === null) {
    return null;
  }

  const contrast = edge - centre;
  if (contrast < MIN_CONTRAST) {
    return null;
  }
  const threshold = centre + EDGE_FRACTION * contrast;

  const crossings: number[] = [];
  let uncrossed = 0;
  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let crossing: number | null = null;
    for (let step = 1; step <= STEPS_PER_RAY; step++) {
      const radius = (step / STEPS_PER_RAY) * irisRadiusPx;
      const luminance = sampleAt(
        field,
        irisCentre.x + dx * radius,
        irisCentre.y + dy * radius,
      );
      if (luminance === null) {
        continue;
      }
      if (luminance >= threshold) {
        crossing = radius;
        break;
      }
    }
    if (crossing === null) {
      uncrossed++;
    } else {
      crossings.push(crossing);
    }
  }

  if (crossings.length === 0) {
    return null;
  }
  if (uncrossed / RAY_COUNT > MAX_UNCROSSED_FRACTION) {
    return null;
  }

  const median = percentile(crossings, 50);
  const lowerQuartile = percentile(crossings, 25);
  const upperQuartile = percentile(crossings, 75);
  if (
    median === null ||
    lowerQuartile === null ||
    upperQuartile === null ||
    median <= 0
  ) {
    return null;
  }
  if ((upperQuartile - lowerQuartile) / median > MAX_SPREAD_RATIO) {
    return null;
  }

  const ratio = median / irisRadiusPx;
  if (ratio < MIN_PUPIL_IRIS_RATIO || ratio > MAX_PUPIL_IRIS_RATIO) {
    return null;
  }

  return ratio * IRIS_DIAMETER_MM;
}

// An integer pixel rectangle within a frame.
export type PixelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Rec. 601 luma weights: how much each channel contributes to perceived
// brightness. The pupil is dark in luminance, not in any one channel.
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;
const CHANNELS = 4;
const MAX_CHANNEL = 255;

// Crop a rectangular region of an RGBA frame into a luminance field:
// grayscale by Rec. 601 luma, normalised to [0, 1]. This is the pure
// half of reading the eye off the canvas -- the io layer calls
// getImageData and hands the raw bytes here; core never touches a
// canvas. Returns null when the frame size does not match the pixel
// array, or the box is empty or falls outside the frame, so a bad crop
// is a refusal rather than a field full of edge pixels.
export function luminanceField(
  rgba: ArrayLike<number>,
  frameWidth: number,
  frameHeight: number,
  box: PixelBox,
): LuminanceField | null {
  if (frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }
  if (rgba.length !== frameWidth * frameHeight * CHANNELS) {
    return null;
  }
  const x0 = Math.round(box.x);
  const y0 = Math.round(box.y);
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (width <= 0 || height <= 0) {
    return null;
  }
  if (
    x0 < 0 ||
    y0 < 0 ||
    x0 + width > frameWidth ||
    y0 + height > frameHeight
  ) {
    return null;
  }
  const samples: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = ((y0 + y) * frameWidth + (x0 + x)) * CHANNELS;
      const red = rgba[index] ?? 0;
      const green = rgba[index + 1] ?? 0;
      const blue = rgba[index + 2] ?? 0;
      samples.push(
        (LUMA_RED * red + LUMA_GREEN * green + LUMA_BLUE * blue) / MAX_CHANNEL,
      );
    }
  }
  return { samples, width, height };
}

// The rectangle of the frame to sample for the pupil, and the iris centre
// translated into that rectangle's own coordinates. A margin past the iris
// radius gives the estimator room to find the bright rim; the box is clamped
// to the frame, so an iris near an edge yields a smaller box (and the
// estimator refuses if its rays then run off it). Pure: the io layer uses
// the box to crop pixels, then passes the field and this centre straight to
// pupilDiameterMm. Returns null when there is no iris to box -- a
// non-positive radius, a degenerate frame, or a centre off the frame.
export function irisSampleRegion(
  irisCentrePx: Point2,
  irisRadiusPx: number,
  frameWidth: number,
  frameHeight: number,
  marginFactor = 1.4,
): { box: PixelBox; centre: Point2 } | null {
  if (irisRadiusPx <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }
  if (
    irisCentrePx.x < 0 ||
    irisCentrePx.y < 0 ||
    irisCentrePx.x > frameWidth ||
    irisCentrePx.y > frameHeight
  ) {
    return null;
  }
  const half = irisRadiusPx * marginFactor;
  // Clamped to the frame. With the centre in the frame and a positive
  // radius, the box always has at least one pixel, so no empty-box guard
  // is reachable here.
  const left = Math.max(0, Math.floor(irisCentrePx.x - half));
  const top = Math.max(0, Math.floor(irisCentrePx.y - half));
  const right = Math.min(frameWidth, Math.ceil(irisCentrePx.x + half));
  const bottom = Math.min(frameHeight, Math.ceil(irisCentrePx.y + half));
  return {
    box: { x: left, y: top, width: right - left, height: bottom - top },
    centre: { x: irisCentrePx.x - left, y: irisCentrePx.y - top },
  };
}
