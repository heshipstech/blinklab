import {
  PERCLOS_CLOSED_FRACTION,
  PERCLOS_MIN_OBSERVED_MS,
  PERCLOS_MIN_SAMPLES,
  PERCLOS_STALE_MS,
  PERCLOS_WINDOW_MS,
} from "./perclos";

// Roadmap 12.10. PERCLOS draws one line at 40% of baseline and reports
// the share of the last minute spent below it. This is the honest
// multi-line version: the same eyes-closed share at four depths —
// 60, 50, 40, 30 percent of the frozen baseline — so a reader sees not
// just "closed 8% of the minute" but how that share falls as the
// closure demanded gets deeper. PERCLOS is one point on this curve.
//
// INSTRUMENT-REFERENCED, NOT LITERATURE P80. The literature's PERCLOS
// draws its line at 20% of baseline, and this instrument cannot reach
// there: a fully shut eye reads about a third of baseline, because the
// model stops short of a zero aperture, so a 20% line sits below the
// floor and would read zero through a real closure (the same reason
// perclos.ts moved its own line off P80). Every threshold here is a
// fraction of THIS instrument's measured baseline, the same
// instrument-adjusted convention perclos committed, and none is P80.
//
// THE SCORE IS UNTOUCHED. score.ts reads the 40% perclos column and
// only that; this family is export and panel material, a fuller
// picture beside the number the score already uses.
//
// The window, the floors and the strictly-below boundary are perclos's
// own, imported rather than re-chosen so the family and the column it
// contains cannot drift apart. Where perclos stores one boolean per
// sample — closed at 40% or not — this stores the aperture and the
// baseline of the moment, because the same frame is closed at some
// thresholds and open at others, and the classification is deferred to
// read time, one threshold at a time.

// The family's thresholds, LOOSEST FIRST so the closed shares read
// monotone non-increasing: a frame shut past 60% of baseline includes
// every frame shut past 30%, so share(0.6) >= share(0.5) >= share(0.4)
// >= share(0.3) over any one window, by construction. 0.4 is aliased
// from perclos.ts's own line, so the shared 40% point can never drift
// from the column the score reads.
export const CLOSURE_FRACTIONS = [
  0.6,
  0.5,
  PERCLOS_CLOSED_FRACTION,
  0.3,
] as const;

type CurveSample = {
  timestampMs: number;
  apertureMm: number;
  baselineMm: number;
};

export type PerclosCurveState = {
  samples: readonly CurveSample[];
};

export function emptyPerclosCurve(): PerclosCurveState {
  return { samples: [] };
}

// The same push discipline as perclosStep: classification is deferred,
// but the window, the backwards-clock guard and the null-skip are
// identical. A frame with no aperture or no baseline joins neither side
// and leaves a gap; a sample stamped before the newest is ignored so
// it cannot disorder the window and age out its neighbours.
export function perclosCurveStep(
  state: PerclosCurveState,
  nowMs: number,
  apertureMm: number | null,
  baselineMm: number | null,
): PerclosCurveState {
  const newest = state.samples[state.samples.length - 1];
  if (newest !== undefined && nowMs < newest.timestampMs) {
    return state;
  }
  const kept = state.samples.filter(
    (sample) => nowMs - sample.timestampMs <= PERCLOS_WINDOW_MS,
  );
  if (apertureMm === null || baselineMm === null) {
    return { samples: kept };
  }
  return {
    samples: [...kept, { timestampMs: nowMs, apertureMm, baselineMm }],
  };
}

// The closed share at ONE threshold fraction, or null when the window
// cannot support a number — the same four floors perclosValue applies,
// in the same order, and the same strictly-below-the-line boundary
// (aperture < fraction * baseline), so at 0.4 this reproduces perclos
// sample for sample.
export function perclosCurveValueAt(
  state: PerclosCurveState,
  nowMs: number,
  fraction: number,
): number | null {
  const inWindow = state.samples.filter(
    (sample) => nowMs - sample.timestampMs <= PERCLOS_WINDOW_MS,
  );
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  if (last.timestampMs - first.timestampMs < PERCLOS_MIN_OBSERVED_MS) {
    return null;
  }
  if (inWindow.length < PERCLOS_MIN_SAMPLES) {
    return null;
  }
  if (nowMs - last.timestampMs > PERCLOS_STALE_MS) {
    return null;
  }
  let closedCount = 0;
  for (const sample of inWindow) {
    if (sample.apertureMm < fraction * sample.baselineMm) {
      closedCount++;
    }
  }
  return closedCount / inWindow.length;
}

// The whole family, loosest to strictest. Every entry reads the SAME
// window, so either all four are numbers or all four are null: the
// floors depend on the window, not the threshold, so a window that
// cannot support one line cannot support any.
export function perclosCurve(
  state: PerclosCurveState,
  nowMs: number,
): (number | null)[] {
  return CLOSURE_FRACTIONS.map((fraction) =>
    perclosCurveValueAt(state, nowMs, fraction),
  );
}
