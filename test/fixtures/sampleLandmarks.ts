import type { Point2 } from "../../src/core/geometry";

// Hand made normalised landmarks with positions that are easy to
// check by head: corners, centre, and one asymmetric point.
export const sampleNormalizedLandmarks: readonly Point2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 0.5, y: 0.5 },
  { x: 0.25, y: 0.75 },
];
