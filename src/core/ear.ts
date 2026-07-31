import { distance, type Point2 } from "./geometry";

// The eye aspect ratio (EAR): two vertical lid chords over twice the
// corner to corner width. Unit free, near 0.3 for an open eye, near
// zero when closed. A ratio, so it survives leaning toward the camera.
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

export function eyeAspectRatio(eye: EyeLandmarks): number | null {
  const widthPx = distance(eye.outerCorner, eye.innerCorner);
  if (widthPx <= 0) {
    return null;
  }
  return (
    (distance(eye.upperOuter, eye.lowerOuter) +
      distance(eye.upperInner, eye.lowerInner)) /
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
