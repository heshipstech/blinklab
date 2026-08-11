export type Point2 = {
  x: number;
  y: number;
};

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// The aspect ratio trap: normalised x is a fraction of the frame
// WIDTH, normalised y of the HEIGHT. On a 16:9 frame those units
// differ by nearly a factor of two, so a measurement must convert to
// pixels FIRST and only then mix directions. The aperture did this
// from the start; the displayed eye aspect ratio skipped it until the
// August 2026 audit measured the cost, a reading 1.8 times the
// standard definition that drifted 27 percent under head roll. The
// helper lives here so both callers share one conversion and a third
// measurement cannot quietly skip it again.
export function toPixels(
  p: Point2,
  frameWidthPx: number,
  frameHeightPx: number,
): Point2 {
  return { x: p.x * frameWidthPx, y: p.y * frameHeightPx };
}
