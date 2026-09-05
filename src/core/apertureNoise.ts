import { percentile } from "./statistics";

// The aperture noise floor, roadmap 10.7a.
//
// Every millimetre the page prints rides apertureMm, and no committed
// number said how much that measurement wobbles when nothing happens.
// These statistics measure exactly that from a series of per-frame
// apertures: how far consecutive still frames disagree with each
// other, and how far the two eyes of one face disagree at the same
// instant. The committed floor lives in docs/aperture-noise-floor.txt,
// where a prediction preceded it; a test recomputes it from the
// recorded fixture so the published number can never drift from the
// code that measures it.
//
// Pure on purpose: series in, statistics out, null when a statistic
// has nothing to stand on — a floor computed over zero frames is not
// a small floor, it is no floor.

/**
 * The stillness rule, fixed in the committed prediction before any
 * real number was computed: a frame is excluded when either eye reads
 * below this fraction of that eye's own session median. The fixture
 * holds two real blinks, and a noise floor polluted by blink slopes
 * would not be a floor.
 */
export const STILLNESS_FRACTION = 0.75;

function medianOf(values: readonly number[]): number | null {
  return percentile(values, 50);
}

/**
 * Which frames of one eye's series count as still: measured, and at
 * or above STILLNESS_FRACTION of the series' own median. The median
 * is the series' own so a small face is a small face, not a long
 * blink.
 */
export function stillnessMask(series: readonly (number | null)[]): boolean[] {
  const measured = series.filter((value): value is number => value !== null);
  const median = medianOf(measured);
  if (median === null) {
    return series.map(() => false);
  }
  const floor = median * STILLNESS_FRACTION;
  return series.map((value) => value !== null && value >= floor);
}

/**
 * The absolute changes between consecutive KEPT frames. A delta counts
 * only when both of its endpoints are kept: bridging an excluded blink
 * would smuggle the blink's slope back into the floor it was excluded
 * from.
 */
export function consecutiveKeptDeltas(
  series: readonly (number | null)[],
  mask: readonly boolean[],
): number[] {
  const deltas: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1];
    const current = series[i];
    if (
      mask[i - 1] === true &&
      mask[i] === true &&
      previous !== null &&
      previous !== undefined &&
      current !== null &&
      current !== undefined
    ) {
      deltas.push(Math.abs(current - previous));
    }
  }
  return deltas;
}

export type EyeNoise = {
  medianDeltaMm: number | null;
  p95DeltaMm: number | null;
};

export type ApertureNoiseStats = {
  keptFrames: number;
  excludedFrames: number;
  left: EyeNoise;
  right: EyeNoise;
  crossEye: { medianMm: number | null; p95Mm: number | null };
};

function eyeNoise(deltas: readonly number[]): EyeNoise {
  return {
    medianDeltaMm: medianOf(deltas),
    p95DeltaMm: percentile(deltas, 95),
  };
}

/**
 * The whole floor from the two eyes' series. A frame is kept only when
 * BOTH eyes keep it — the cross-eye disagreement needs both present,
 * and a floor whose two eyes counted different frames would compare
 * different moments.
 */
export function apertureNoiseStats(
  left: readonly (number | null)[],
  right: readonly (number | null)[],
): ApertureNoiseStats {
  const leftMask = stillnessMask(left);
  const rightMask = stillnessMask(right);
  const kept = left.map(
    (_, index) => leftMask[index] === true && rightMask[index] === true,
  );
  const keptFrames = kept.filter(Boolean).length;

  const crossEye: number[] = [];
  for (let i = 0; i < left.length; i += 1) {
    const l = left[i];
    const r = right[i];
    if (kept[i] === true && l != null && r != null) {
      crossEye.push(Math.abs(l - r));
    }
  }

  return {
    keptFrames,
    excludedFrames: left.length - keptFrames,
    left: eyeNoise(consecutiveKeptDeltas(left, kept)),
    right: eyeNoise(consecutiveKeptDeltas(right, kept)),
    crossEye: {
      medianMm: medianOf(crossEye),
      p95Mm: percentile(crossEye, 95),
    },
  };
}
