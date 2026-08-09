import type { Point2 } from "./geometry";

// One timed value of any rolling signal: EAR since 3.2, gaze offsets
// since 5.6. The mapper below never asks what the number means.
export type TimedSample = {
  timestampMs: number;
  // null means no trustworthy measurement existed at that moment.
  // It draws as a gap in the line, never as a zero.
  value: number | null;
};

/**
 * Keep the samples a trace can actually draw, and no others.
 *
 * Every trace buffer used to be capped by COUNT, and the counts were
 * chosen for an assumed frame rate. That is the wrong shape of rule for
 * a fixed time window and it failed four times in one day. 1200 samples
 * is 20 seconds at 60 frames per second and 9.2 seconds at 130, which
 * is what a 120 Hz display produces, so a 10 second window silently
 * stopped being covered and every trace began part way in and never
 * reached the left edge. It was fixed one buffer at a time, and each
 * fix left the others wrong, because the same number was written out by
 * hand in four places.
 *
 * A window bounded buffer cannot have that fault. There is no rate to
 * assume and no number to keep in step: the buffer holds the window,
 * whatever the machine is doing. Memory stays bounded because the
 * window does.
 *
 * Two sided on purpose. The old one sided test asked only whether a
 * sample was too OLD, which is a subtraction, and a subtraction changes
 * sign when the clock restarts at zero for a new clip. Every stale
 * sample then read as negative age and survived forever. A sample from
 * the future is not a sample.
 */
export function withinWindow<T extends { timestampMs: number }>(
  samples: readonly T[],
  nowMs: number,
  windowMs: number,
): T[] {
  return samples.filter(
    (sample) =>
      sample.timestampMs <= nowMs && nowMs - sample.timestampMs <= windowMs,
  );
}

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
