export type Point2 = {
  x: number;
  y: number;
};

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
