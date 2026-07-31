import type { Point2 } from "./geometry";

export type EarSample = {
  timestampMs: number;
  // null means no trustworthy measurement existed at that moment.
  // It draws as a gap in the line, never as a zero.
  ear: number | null;
};

// Maps timed samples onto canvas polyline segments. Time runs left to
// right across the window, the value runs bottom to top on a FIXED
// scale, and null samples split the line into separate segments.
export function sparklineSegments(
  samples: readonly EarSample[],
  nowMs: number,
  windowMs: number,
  widthPx: number,
  heightPx: number,
  earMax: number,
): Point2[][] {
  const windowStartMs = nowMs - windowMs;
  const segments: Point2[][] = [];
  let current: Point2[] = [];

  for (const sample of samples) {
    if (sample.timestampMs < windowStartMs || sample.timestampMs > nowMs) {
      continue;
    }
    if (sample.ear === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    const clamped = Math.min(Math.max(sample.ear, 0), earMax);
    current.push({
      x: ((sample.timestampMs - windowStartMs) / windowMs) * widthPx,
      y: heightPx - (clamped / earMax) * heightPx,
    });
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}
