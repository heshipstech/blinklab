import type { EarIndexMap } from "./ear";
import { distance, type Point2 } from "./geometry";

// The raw gaze signal: where the iris centre sits inside its eye,
// as fractions of the eye width. Measured by projecting onto the
// eye's own corner axis, so head roll rotates signal and ruler
// together and cannot fake a glance. Conventions: horizontal
// positive toward IMAGE RIGHT, vertical positive toward IMAGE
// BOTTOM, in unmirrored measurement space like everything else.
export type IrisOffset = {
  horizontal: number;
  vertical: number;
};

export function irisOffset(
  face: readonly Point2[],
  ear: EarIndexMap,
  irisCenterIndex: number,
  eye: "right" | "left",
  frameWidthPx: number,
  frameHeightPx: number,
): IrisOffset | null {
  const outer = face[ear.outerCorner];
  const inner = face[ear.innerCorner];
  const iris = face[irisCenterIndex];
  if (outer === undefined || inner === undefined || iris === undefined) {
    return null;
  }
  const px = (p: Point2): Point2 => ({
    x: p.x * frameWidthPx,
    y: p.y * frameHeightPx,
  });
  const outerPx = px(outer);
  const innerPx = px(inner);
  const irisPx = px(iris);

  // The axis points toward image right for either eye: the subject's
  // right eye has its inner corner on that side, the left its outer.
  const from = eye === "right" ? outerPx : innerPx;
  const to = eye === "right" ? innerPx : outerPx;
  const widthPx = distance(from, to);
  if (widthPx <= 0) {
    return null;
  }
  const ux = (to.x - from.x) / widthPx;
  const uy = (to.y - from.y) / widthPx;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = irisPx.x - midX;
  const dy = irisPx.y - midY;

  return {
    horizontal: (dx * ux + dy * uy) / widthPx,
    vertical: (dx * -uy + dy * ux) / widthPx,
  };
}
