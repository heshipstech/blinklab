import {
  BASELINE_LEARN_MS,
  BASELINE_MEDIAN_CEILING_FACTOR,
  BASELINE_MEDIAN_PERCENTILE,
  BASELINE_MIN_SAMPLES,
  BASELINE_PERCENTILE,
  BASELINE_THRESHOLD_FRACTION,
} from "./constants";
import { percentile } from "./statistics";

// The personal baseline: what does OPEN mean for this person's eyes.
// Learned over thirty seconds, then FROZEN, like any instrument that
// is calibrated and then used. It never falls, so a drooping lid, the
// very thing later phases want to notice, cannot quietly lower the
// bar that would expose it. And since 20 August 2026 it never rises
// either: the six-person validation round's pre-registered baseline
// criterion FAILED because the old rise-only ratchet moved one
// volunteer's ruler 34.6 percent DURING the measurement and
// another's 15.4 percent just before it, and a ruler that moves
// under the measurement is not a ruler. The full evidence and the
// corpus predictions are in docs/baseline-freeze.txt.
//
// Fix #126's ceiling survives with exactly one job left: bounding
// the BIRTH estimate, because the baseline is a p90 and a p90 is
// what a surprised learning window inflates. The factor is the
// validation plan's own pre-registered implausibility line.
export type BaselineState =
  | { kind: "learning"; startedAtMs: number; samples: number[] }
  | { kind: "ready"; baselineMm: number };

export function startBaseline(nowMs: number): BaselineState {
  return { kind: "learning", startedAtMs: nowMs, samples: [] };
}

export function baselineStep(
  state: BaselineState,
  nowMs: number,
  apertureMm: number | null,
): BaselineState {
  // Backwards clock: ignored, state unchanged. A sample stamped
  // before the learning started would stretch the window into the
  // past. Issue #107, remediation C3.
  if (state.kind === "learning" && nowMs < state.startedAtMs) {
    return state;
  }
  if (state.kind === "learning") {
    const samples =
      apertureMm === null ? state.samples : [...state.samples, apertureMm];
    const elapsed = nowMs - state.startedAtMs;
    if (
      elapsed >= BASELINE_LEARN_MS &&
      samples.length >= BASELINE_MIN_SAMPLES
    ) {
      const baselineMm = boundedBaseline(samples);
      if (baselineMm !== null) {
        return { kind: "ready", baselineMm };
      }
    }
    return { ...state, samples };
  }

  // Ready means frozen. No sample after birth moves the ruler in
  // either direction: not a droop (fix #126's non-negotiable) and,
  // since the round, not a widening either, because in a live
  // session a genuine widening and the P3 failure are the same
  // signal. The trade this makes, a ruler born short stays short,
  // is stated in docs/baseline-freeze.txt rather than hidden.
  return state;
}

// The p90 of the learning window, held under a multiple of that
// window's own median. Null only when the window is empty.
function boundedBaseline(samples: readonly number[]): number | null {
  const wide = percentile(samples, BASELINE_PERCENTILE);
  const middle = percentile(samples, BASELINE_MEDIAN_PERCENTILE);
  if (wide === null || middle === null) {
    return wide;
  }
  return Math.min(wide, middle * BASELINE_MEDIAN_CEILING_FACTOR);
}

export function personalThresholdMm(state: BaselineState): number | null {
  return state.kind === "ready"
    ? state.baselineMm * BASELINE_THRESHOLD_FRACTION
    : null;
}

export function learningSecondsLeft(
  state: BaselineState,
  nowMs: number,
): number | null {
  if (state.kind !== "learning") {
    return null;
  }
  return Math.max(
    0,
    Math.ceil((BASELINE_LEARN_MS - (nowMs - state.startedAtMs)) / 1000),
  );
}
