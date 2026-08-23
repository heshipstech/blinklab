import { FEATURE_RECORD_CAP } from "./featureRecord";
import { pushBounded } from "./ringBuffer";

// The validation round's fifth check, moved onto the page while the
// session is still running.
//
// Three of the round's six rulers were unusable, and the check that
// caught the worst shape of failure — a baseline born too long,
// macbookair's silent clip, P5's closure-dragged median — ran in
// Python, days later, on an exported file. The person whose session
// it was saw a page that said everything was fine. This module is
// the same ratio, the frozen baseline over the median aperture of
// the records so far, computed once per record and spoken on the
// page, so the session that cannot be trusted says so while there
// is still time to run another one.
//
// The agreements with analysis/blinklab/validation_checks.py, each
// pinned by a test, because two implementations of one check that
// drift apart are worse than either alone:
//
//   - the ceiling is the same 1.25, strictly above, and a Python
//     test reads this file to hold the two constants together;
//   - the median interpolates like pandas' (the two middle values
//     average on an even count), which the repository's own
//     nearest-rank percentile() does NOT, and which is why this
//     module carries its own median rather than borrowing one that
//     serves other published numbers;
//   - the median is over ALL records, closed eyes included. The
//     plan's stated reason: filtering by the blink line would use
//     the baseline to choose the frames that judge the baseline.
//     P5's flag was earned exactly there;
//   - the series is bounded by the SAME cap as the export buffer,
//     because the Python check reads the file and the file holds
//     the last FEATURE_RECORD_CAP rows.

export const BASELINE_OVER_RESTING_CEILING = 1.25;

// How long the instantaneous verdict must disagree with the spoken
// one before the page changes its words. The ratio is a running
// median and 1.25 is a line, so a session living near the line (P6
// published at 1.23) would flap a naive verdict every few seconds,
// and a warning that comes and goes teaches a person to ignore it.
// Fifteen records is about fifteen seconds, half the learning
// window: long enough that a single odd second cannot flip the
// sentence, short enough that a genuine crossing is named while the
// session still has most of its life ahead. The dwell delays WORDS
// only — the exported ratio is instantaneous on every row, so the
// file never inherits the smoothing.
export const RULER_FIT_DWELL_RECORDS = 15;

export type RulerFitVerdict = "fits" | "tooLong";

export type RulerFitState = {
  // One entry per feature record, null when that record measured no
  // aperture, bounded like the record buffer itself. Nulls hold
  // their place so this series and the exported column stay the
  // same length seen through the same window.
  readonly apertures: readonly (number | null)[];
  // What the page currently says, distinct from what the ratio
  // currently is. Null until the first verdict exists.
  readonly shown: RulerFitVerdict | null;
  // Consecutive records whose instantaneous verdict disagreed with
  // `shown`. Reset by any agreeing record.
  readonly pendingRun: number;
};

export const initialRulerFitState: RulerFitState = {
  apertures: [],
  shown: null,
  pendingRun: 0,
};

/**
 * The median the published check computes: pandas' interpolating
 * median over the non-null values, which averages the two middle
 * values on an even count. Null when nothing was measured.
 */
export function restingMedianMm(
  apertures: readonly (number | null)[],
): number | null {
  const values = apertures.filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }
  const low = sorted[middle - 1];
  const high = sorted[middle];
  return low === undefined || high === undefined ? null : (low + high) / 2;
}

export type RulerFit = {
  /** The baseline over the resting median, the round's fifth column. */
  ratio: number;
  restingMedianMm: number;
  /** Records that measured an aperture, not records seen. */
  sampleCount: number;
  /** Instantaneous: strictly above the ceiling, exactly as Python judges. */
  verdict: RulerFitVerdict;
};

/**
 * The fit of the ruler to the eye it measures, as of now. Null while
 * there is no baseline or no measured aperture: a verdict about a
 * ruler that does not exist yet would be a guess wearing a verdict.
 */
export function describeRulerFit(
  state: RulerFitState,
  baselineMm: number | null,
): RulerFit | null {
  if (baselineMm === null) {
    return null;
  }
  const median = restingMedianMm(state.apertures);
  if (median === null || median <= 0) {
    return null;
  }
  const ratio = baselineMm / median;
  return {
    ratio,
    restingMedianMm: median,
    sampleCount: state.apertures.filter((value) => value !== null).length,
    verdict: ratio > BASELINE_OVER_RESTING_CEILING ? "tooLong" : "fits",
  };
}

/**
 * One record's worth of accumulation: the aperture joins the series
 * whether or not a baseline exists yet, because the published median
 * is over the whole file, learning window included. The spoken
 * verdict follows the instantaneous one immediately the first time,
 * and only after RULER_FIT_DWELL_RECORDS consecutive disagreements
 * ever after.
 */
export function rulerFitStep(
  state: RulerFitState,
  apertureMm: number | null,
  baselineMm: number | null,
): RulerFitState {
  const apertures = pushBounded(
    state.apertures,
    apertureMm,
    FEATURE_RECORD_CAP,
  );
  const fit = describeRulerFit({ ...state, apertures }, baselineMm);
  if (fit === null) {
    return { apertures, shown: state.shown, pendingRun: 0 };
  }
  if (state.shown === null || fit.verdict === state.shown) {
    return {
      apertures,
      shown: state.shown ?? fit.verdict,
      pendingRun: 0,
    };
  }
  const pendingRun = state.pendingRun + 1;
  if (pendingRun >= RULER_FIT_DWELL_RECORDS) {
    return { apertures, shown: fit.verdict, pendingRun: 0 };
  }
  return { apertures, shown: state.shown, pendingRun };
}

/**
 * The page's sentence. The ratio in it is instantaneous and the
 * verdict word is dwelled, so for up to the dwell the two can
 * disagree; the fitting sentence therefore asserts nothing about
 * the comparison — it shows the ratio beside the ceiling and lets a
 * reader see for themselves — and only the settled too-long verdict
 * adds words. A sentence that could read "1.27 x" and "under 1.25"
 * in the same breath is the alternative this shape refuses.
 */
export function rulerFitMessage(
  state: RulerFitState,
  baselineMm: number | null,
): string {
  const fit = describeRulerFit(state, baselineMm);
  if (fit === null || state.shown === null) {
    return "Ruler fit: waiting for the baseline";
  }
  const ratio = fit.ratio.toFixed(2);
  const ceiling = BASELINE_OVER_RESTING_CEILING.toFixed(2);
  return state.shown === "tooLong"
    ? `Ruler fit: baseline is ${ratio} x your resting eye, too long to trust (ceiling ${ceiling})`
    : `Ruler fit: baseline is ${ratio} x your resting eye (ceiling ${ceiling})`;
}
