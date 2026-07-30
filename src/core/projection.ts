import type { Point2 } from "./geometry";
import { applyTransform, type DrawTransform } from "./transform";

// The model speaks normalised coordinates, 0 to 1 across the frame.
// The canvas speaks pixels, possibly mirrored. This is the bridge,
// and it must be the only bridge, so picture and dots cannot disagree.
export function projectNormalizedPoint(
  normalized: Point2,
  widthPx: number,
  heightPx: number,
  transform: DrawTransform,
): Point2 {
  return applyTransform(transform, {
    x: normalized.x * widthPx,
    y: normalized.y * heightPx,
  });
}
