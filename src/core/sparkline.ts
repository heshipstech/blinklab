import type { Point2 } from "./geometry";

// One timed value of any rolling signal: EAR since 3.2, gaze offsets
// since 5.6. The mapper below never asks what the number means.
export type TimedSample = {
  timestampMs: number;
  // null means no trustworthy measurement existed at that moment.
  // It draws as a gap in the line, never as a zero.
  value: number | null;
};

// Maps timed samples onto canvas polyline segments. Time runs left to
// right across the window, the value runs bottom to top on a FIXED
// scale, and null samples split the line into separate segments.
export function sparklineSegments(
  samples: readonly TimedSample[],
  nowMs: number,
  windowMs: number,
  widthPx: number,
  heightPx: number,
  valueMax: number,
): Point2[][] {
  const windowStartMs = nowMs - windowMs;
  const segments: Point2[][] = [];
  let current: Point2[] = [];

  for (const sample of samples) {
    if (sample.timestampMs < windowStartMs || sample.timestampMs > nowMs) {
      continue;
    }
    if (sample.value === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    const clamped = Math.min(Math.max(sample.value, 0), valueMax);
    current.push({
      x: ((sample.timestampMs - windowStartMs) / windowMs) * widthPx,
      y: heightPx - (clamped / valueMax) * heightPx,
    });
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}
