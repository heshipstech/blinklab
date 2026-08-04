import type { IrisOffset } from "./gazeOffset";

// I-DT, identification by dispersion threshold (Salvucci and
// Goldberg, 2000), the standard explainable fixation detector. The
// eye does not glide, it hops: it parks on a spot (a fixation), then
// jumps fast to the next (a saccade). The rule that separates them
// needs two thresholds, one in space and one in time: a fixation is
// any stretch of gaze that stays inside a small dispersion box for
// at least a minimum duration. Everything else is movement.

// How large the box is, in offset units, as horizontal range plus
// vertical range. Smoothed jitter spreads well under this, a glance
// between screen regions moves far beyond it.
export const FIXATION_DISPERSION_THRESHOLD = 0.02;

// How long the gaze must stay boxed before stillness counts as a
// fixation. Shorter pauses are the eye passing through.
export const MIN_FIXATION_DURATION_MS = 120;

export type GazeSample = {
  timestampMs: number;
  offset: IrisOffset;
};

export type Fixation = {
  startMs: number;
  endMs: number;
  centroid: IrisOffset;
};

// The dispersion of a window: how far it spreads on each axis, both
// axes summed. Null for an empty window, zero for a single sample.
export function dispersionOffset(
  samples: readonly GazeSample[],
): number | null {
  let minH = Infinity;
  let maxH = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const sample of samples) {
    minH = Math.min(minH, sample.offset.horizontal);
    maxH = Math.max(maxH, sample.offset.horizontal);
    minV = Math.min(minV, sample.offset.vertical);
    maxV = Math.max(maxV, sample.offset.vertical);
  }
  if (minH > maxH) {
    return null;
  }
  return maxH - minH + (maxV - minV);
}

function centroidOf(samples: readonly GazeSample[]): IrisOffset {
  let horizontal = 0;
  let vertical = 0;
  for (const sample of samples) {
    horizontal += sample.offset.horizontal / samples.length;
    vertical += sample.offset.vertical / samples.length;
  }
  return { horizontal, vertical };
}

export function detectFixations(
  samples: readonly GazeSample[],
  dispersionThreshold: number = FIXATION_DISPERSION_THRESHOLD,
  minDurationMs: number = MIN_FIXATION_DURATION_MS,
): Fixation[] {
  const fixations: Fixation[] = [];
  let start = 0;
  while (start < samples.length) {
    const first = samples[start];
    if (first === undefined) {
      break;
    }
    // Seed a window that spans the minimum duration. If the samples
    // run out before the span is covered, no fixation can begin here
    // or anywhere later.
    let end = start;
    while (true) {
      const candidate = samples[end];
      if (candidate === undefined) {
        return fixations;
      }
      if (candidate.timestampMs - first.timestampMs >= minDurationMs) {
        break;
      }
      end++;
    }
    const seed = samples.slice(start, end + 1);
    const seedDispersion = dispersionOffset(seed);
    if (seedDispersion !== null && seedDispersion <= dispersionThreshold) {
      // The seed fits the box: extend while it still fits, then the
      // whole stretch is one fixation and the search continues after
      // it. Exactly at the threshold still counts as boxed.
      while (end + 1 < samples.length) {
        const extended = dispersionOffset(samples.slice(start, end + 2));
        if (extended === null || extended > dispersionThreshold) {
          break;
        }
        end++;
      }
      const window = samples.slice(start, end + 1);
      const last = window[window.length - 1];
      if (last !== undefined) {
        fixations.push({
          startMs: first.timestampMs,
          endMs: last.timestampMs,
          centroid: centroidOf(window),
        });
      }
      start = end + 1;
    } else {
      // The seed spreads too far: the gaze was moving here. Slide one
      // sample forward and try again.
      start++;
    }
  }
  return fixations;
}
