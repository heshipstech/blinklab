import { distance, toPixels, type Point2 } from "./geometry";

// The eye aspect ratio (EAR): two vertical lid chords over twice the
// corner to corner width, the Soukupova and Cech definition. Unit
// free, near 0.3 for an open eye, near zero when closed. A ratio, so
// it survives leaning toward the camera.
//
// Computed in PIXELS, not in normalised coordinates. The published
// definition is pixel geometry, and normalised units are anisotropic:
// x is a fraction of the frame width, y of the height. Until 11 August
// 2026 this function skipped the conversion, so on a 16:9 camera the
// displayed ratio read about 1.8 times the standard value and fell 27
// percent by 30 degrees of roll, about 20 at the pose gate's 25 degree
// limit, on a quantity SPEC.md declares roll invariant. The tilt invariance test now runs
// on a 1280x720 frame, where skipping the conversion cannot hide.
export type EyeLandmarks = {
  outerCorner: Point2;
  innerCorner: Point2;
  upperOuter: Point2;
  lowerOuter: Point2;
  upperInner: Point2;
  lowerInner: Point2;
};

export type EarIndexMap = {
  outerCorner: number;
  innerCorner: number;
  upperOuter: number;
  lowerOuter: number;
  upperInner: number;
  lowerInner: number;
};

export function eyeAspectRatio(
  eye: EyeLandmarks,
  frameWidthPx: number,
  frameHeightPx: number,
): number | null {
  // Written to fail CLOSED on a poisoned frame size: NaN makes both
  // comparisons false, so the answer is a refusal rather than a
  // confident wrong ratio. The audit found seven gates that fail open
  // on NaN; this one, added after, does not join them.
  if (!(frameWidthPx > 0) || !(frameHeightPx > 0)) {
    return null;
  }
  const px = (p: Point2) => toPixels(p, frameWidthPx, frameHeightPx);
  const widthPx = distance(px(eye.outerCorner), px(eye.innerCorner));
  if (widthPx <= 0) {
    return null;
  }
  return (
    (distance(px(eye.upperOuter), px(eye.lowerOuter)) +
      distance(px(eye.upperInner), px(eye.lowerInner))) /
    (2 * widthPx)
  );
}

export function eyeLandmarksFromFace(
  face: readonly Point2[],
  map: EarIndexMap,
): EyeLandmarks | null {
  const outerCorner = face[map.outerCorner];
  const innerCorner = face[map.innerCorner];
  const upperOuter = face[map.upperOuter];
  const lowerOuter = face[map.lowerOuter];
  const upperInner = face[map.upperInner];
  const lowerInner = face[map.lowerInner];
  if (
    outerCorner === undefined ||
    innerCorner === undefined ||
    upperOuter === undefined ||
    lowerOuter === undefined ||
    upperInner === undefined ||
    lowerInner === undefined
  ) {
    return null;
  }
  return {
    outerCorner,
    innerCorner,
    upperOuter,
    lowerOuter,
    upperInner,
    lowerInner,
  };
}
