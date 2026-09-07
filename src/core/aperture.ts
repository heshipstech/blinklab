import { IRIS_DIAMETER_MM } from "./constants";
import { distance, toPixels, type Point2 } from "./geometry";
import type { EarIndexMap } from "./ear";

// Pixels lie about size, they inflate as you lean in. The iris does
// not, it is 11.7 mm in nearly everyone. Seeing how many pixels the
// iris spans tells us what a millimetre looks like in this frame, at
// this instant, and the aperture converts through that ruler.
//
// The aspect ratio trap: normalised x is a fraction of the frame
// WIDTH, normalised y of the HEIGHT, so every measurement converts to
// pixels first and only then mixes directions. The conversion lives in
// geometry.ts since 11 August 2026, shared with the eye aspect ratio,
// which used to skip it and paid for that on every 16:9 frame.

// The horizontal iris diameter, ring points right and left. The
// vertical pair would be occluded by the lids exactly when it
// matters most, mid blink.
export function irisWidthPx(
  face: readonly Point2[],
  ring: readonly number[],
  frameWidthPx: number,
  frameHeightPx: number,
): number | null {
  const right = face[ring[0] ?? -1];
  const left = face[ring[2] ?? -1];
  if (right === undefined || left === undefined) {
    return null;
  }
  const widthPx = distance(
    toPixels(right, frameWidthPx, frameHeightPx),
    toPixels(left, frameWidthPx, frameHeightPx),
  );
  return widthPx > 0 ? widthPx : null;
}

// The lid opening in pixels: the mean of the two vertical chords the
// EAR also uses.
export function aperturePx(
  face: readonly Point2[],
  map: EarIndexMap,
  frameWidthPx: number,
  frameHeightPx: number,
): number | null {
  const upperOuter = face[map.upperOuter];
  const lowerOuter = face[map.lowerOuter];
  const upperInner = face[map.upperInner];
  const lowerInner = face[map.lowerInner];
  if (
    upperOuter === undefined ||
    lowerOuter === undefined ||
    upperInner === undefined ||
    lowerInner === undefined
  ) {
    return null;
  }
  const px = (p: Point2) => toPixels(p, frameWidthPx, frameHeightPx);
  return (
    (distance(px(upperOuter), px(lowerOuter)) +
      distance(px(upperInner), px(lowerInner))) /
    2
  );
}

// The iris aspect ratio: its vertical extent over its horizontal one.
// The rim points are ordered right, top, left, bottom (constants.ts),
// so the horizontal chord (right to left) is the same unoccluded ruler
// irisWidthPx uses, and the vertical chord (top to bottom) is the pair
// aperturePx's comment above warns is "occluded by the lids exactly
// when it matters most, mid blink". An open iris is a circle, so the
// ratio is 1; as a lid covers the top rim the vertical chord shrinks
// and the ratio falls toward zero. Both chords go through toPixels
// first, so a non-square frame does not distort the ratio.
//
// This reads the iris rim, never the lid chords, so it is a witness to
// a closure entirely independent of apertureMm — the second measure
// the miss autopsy needs to tell a line placed too high apart from an
// aperture landmark that under-reads a real closure. Whether the model
// tracks the occluded rim or hallucinates a full circle behind the lid
// is the empirical question docs/iris-occlusion.txt commits a
// prediction to before any trace is read.
export function irisAspectRatio(
  face: readonly Point2[],
  ring: readonly number[],
  frameWidthPx: number,
  frameHeightPx: number,
): number | null {
  const right = face[ring[0] ?? -1];
  const top = face[ring[1] ?? -1];
  const left = face[ring[2] ?? -1];
  const bottom = face[ring[3] ?? -1];
  if (
    right === undefined ||
    top === undefined ||
    left === undefined ||
    bottom === undefined
  ) {
    return null;
  }
  const px = (p: Point2) => toPixels(p, frameWidthPx, frameHeightPx);
  const horizontalPx = distance(px(right), px(left));
  if (horizontalPx <= 0) {
    return null;
  }
  const verticalPx = distance(px(top), px(bottom));
  return verticalPx / horizontalPx;
}

/**
 * The lid opening in millimetres, using the iris as the ruler.
 *
 * The division is what makes this independent of how far the face sits
 * from the camera, and it is why the number can be compared across
 * sessions at all.
 *
 * It does NOT make it independent of head angle, and the validity gate
 * accepts a wide one. The opening is a vertical distance and the ruler
 * is a horizontal one, so a nod shrinks the first and a turn shrinks
 * the second: at the gate's limits the result reads 6.03 percent low
 * at 20 degrees of pitch and 10.34 percent high at 25 of yaw
 * (docs/pose-aperture-bias.txt, roadmap 10.10c4c). Roll costs nothing.
 */
export function apertureMm(
  face: readonly Point2[],
  map: EarIndexMap,
  ring: readonly number[],
  frameWidthPx: number,
  frameHeightPx: number,
): number | null {
  const rulerPx = irisWidthPx(face, ring, frameWidthPx, frameHeightPx);
  const openingPx = aperturePx(face, map, frameWidthPx, frameHeightPx);
  if (rulerPx === null || openingPx === null) {
    return null;
  }
  return openingPx * (IRIS_DIAMETER_MM / rulerPx);
}
