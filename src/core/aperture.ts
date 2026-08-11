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
