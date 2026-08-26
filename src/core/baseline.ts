import {
  describeCalibrationWindow,
  type CalibrationWindow,
} from "./calibrationWindow";
import {
  BASELINE_LEARN_MS,
  BASELINE_MIN_SAMPLES,
  BASELINE_THRESHOLD_FRACTION,
} from "./constants";

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
// Fix #126's ceiling survives with exactly one job left, and since
// the refusal (docs/calibration-refusal.txt) that job is REFUSING
// the birth rather than bounding it: a p90 is what a surprised
// learning window inflates, and a window the ceiling binds used to
// birth a clipped ruler that was still 1.35 times one session's
// resting eye — a guess wearing a number's clothes. Bound windows
// now birth nothing; every ready ruler is a raw, unclipped p90. The
// factor is the validation plan's own pre-registered implausibility
// line.
export type BaselineState =
  | { kind: "learning"; startedAtMs: number; samples: number[] }
  // The ruler travels with its birth certificate. One value, one
  // account: `window.baselineMm` and `baselineMm` are the same number
  // by construction, and a test holds them together, so the export
  // cannot describe a birth the page did not use.
  | { kind: "ready"; baselineMm: number; window: CalibrationWindow }
  // The window's top and middle disagreed by more than the ceiling
  // allows, so no ruler exists: numbers that depend on the blink
  // line are withheld rather than guessed. The certificate still
  // travels, because a refused session is a result, not an accident,
  // and an analysis must be able to say why each refusal happened.
  | { kind: "refused"; window: CalibrationWindow };

/**
 * What the person is told, verbatim from docs/calibration-refusal.txt
 * and pinned there by test. The only exit it offers is a restart:
 * silently re-learning mid-session would be the P3 failure again, a
 * ruler that moves while the measurement runs.
 */
export const CALIBRATION_REFUSED_SENTENCE =
  "Calibration was refused: while learning your baseline, the widest eye openings disagreed with the middle ones by more than the instrument allows, which usually means blinks or a squint contaminated the learning period. Numbers that depend on the blink line are withheld rather than guessed. Restart the camera and keep your eyes comfortably open for the first thirty seconds.";

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
      const window = describeCalibrationWindow(samples);
      if (window !== null) {
        return window.ceilingBound
          ? { kind: "refused", window }
          : { kind: "ready", baselineMm: window.baselineMm, window };
      }
    }
    return { ...state, samples };
  }

  // Ready means frozen, and refused means frozen too. No sample
  // after birth moves the ruler in either direction: not a droop
  // (fix #126's non-negotiable) and, since the round, not a widening
  // either, because in a live session a genuine widening and the P3
  // failure are the same signal. The trade this makes, a ruler born
  // short stays short, is stated in docs/baseline-freeze.txt rather
  // than hidden. A refusal is equally final: a calm eye afterwards
  // does not un-refuse, the sentence offers a restart instead.
  return state;
}

// The birth itself lives in calibrationWindow.ts since 23 August
// 2026, DESCRIBED rather than computed in the dark: the p90, the
// median, the spread and whether the ceiling bound are all values
// now, because the macbookair failure was a silent clip nobody could
// see until the Python side read the exported rows days later. The
// birth formula is unchanged and a test re-derives it from the
// plan's constants to prove it.

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
