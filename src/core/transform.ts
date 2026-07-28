import type { Point2 } from "./geometry";

// The six numbers of a 2D affine transform, in canvas setTransform order:
// x' = a*x + c*y + e, y' = b*x + d*y + f.
export type DrawTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export function frameTransform(
  mirrored: boolean,
  frameWidthPx: number,
): DrawTransform {
  return mirrored
    ? { a: -1, b: 0, c: 0, d: 1, e: frameWidthPx, f: 0 }
    : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

export function applyTransform(t: DrawTransform, point: Point2): Point2 {
  return {
    x: t.a * point.x + t.c * point.y + t.e,
    y: t.b * point.x + t.d * point.y + t.f,
  };
}
