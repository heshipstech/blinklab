import {
  BASELINE_MEDIAN_CEILING_FACTOR,
  BASELINE_MEDIAN_PERCENTILE,
  BASELINE_PERCENTILE,
} from "./constants";
import { percentile } from "./statistics";

// The window the ruler was born from, described rather than discarded.
//
// The baseline is a p90 of thirty seconds of apertures, clipped to
// 1.25 times the window's own median, and until now the clip was
// SILENT. On the dry run's macbookair session a handful of frames
// read up to 10.35 mm against a window median of 7.51, the p90
// followed them, and nobody could see it: the person saw nothing, the
// export said nothing, and the defect surfaced five days later when
// the Python side grew an over_resting check reading exported rows
// after the fact. A ruler's birth certificate belongs with the ruler.
//
// This module only DESCRIBES. It moves no measured number — a test
// re-derives the old birth formula from the plan's constants and
// holds this one to it — and it decides nothing: whether a window
// this describes as top-heavy should be REFUSED rather than clipped
// is the next increment, and that one owes a corpus prediction before
// it merges.

/** The birth certificate of one learned baseline. */
export type CalibrationWindow = {
  /** How many valid apertures the thirty seconds actually held. */
  sampleCount: number;
  /** Where the middle of the window sat. */
  medianMm: number;
  /** Where the top sat: the p90 the baseline is taken from. */
  p90Mm: number;
  /**
   * p90 over median: how top-heavy the window was. A steady open eye
   * reads close to 1; the macbookair failure read 1.38, dragged by a
   * few early outlier frames.
   */
  spreadRatio: number;
  /**
   * True when the birth was CLIPPED: the p90 exceeded the median
   * ceiling and the ruler was born at the ceiling instead. A bound
   * ceiling is the instrument saying "this window's top and middle
   * disagree", and until now it said it to nobody.
   */
  ceilingBound: boolean;
  /** What the ruler was actually born at, after any clip. */
  baselineMm: number;
};

/**
 * Describe a learning window, or null for a window holding nothing.
 *
 * Null and never a zero-length ruler: an empty window is a fact about
 * the session, not a measurement of an eye.
 */
export function describeCalibrationWindow(
  samples: readonly number[],
): CalibrationWindow | null {
  const p90Mm = percentile(samples, BASELINE_PERCENTILE);
  const medianMm = percentile(samples, BASELINE_MEDIAN_PERCENTILE);
  if (p90Mm === null || medianMm === null) {
    return null;
  }
  const ceilingMm = medianMm * BASELINE_MEDIAN_CEILING_FACTOR;
  const ceilingBound = p90Mm > ceilingMm;
  return {
    sampleCount: samples.length,
    medianMm,
    p90Mm,
    spreadRatio: medianMm === 0 ? Number.POSITIVE_INFINITY : p90Mm / medianMm,
    ceilingBound,
    baselineMm: ceilingBound ? ceilingMm : p90Mm,
  };
}
