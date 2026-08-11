import {
  BASELINE_LEARN_MS,
  BASELINE_MEDIAN_CEILING_FACTOR,
  BASELINE_MEDIAN_PERCENTILE,
  BASELINE_MIN_SAMPLES,
  BASELINE_PERCENTILE,
  BASELINE_RECENT_CAP,
  BASELINE_RISE_MIN_SAMPLES,
  BASELINE_THRESHOLD_FRACTION,
} from "./constants";
import { pushBounded } from "./ringBuffer";
import { percentile } from "./statistics";

// The personal baseline: what does OPEN mean for this person's eyes.
// Learned over thirty seconds, then allowed to rise but never fall,
// so a drooping lid, the very thing later phases want to notice,
// cannot quietly lower the bar that would expose it.
//
// Fix #126 added a ceiling to the rise. Never falling is right; being
// able to rise without limit was not, because the baseline is a p90
// and a p90 is what a brief excursion moves. The ceiling is a
// multiple of the window's MEDIAN, which a brief excursion barely
// touches, so the two together say: the bar may climb when the eye
// genuinely opens wider, and may not climb because the eye was
// surprised for two seconds.
//
// The ceiling blocks rises only. It never forces a fall, or a
// drooping lid would lower its own bar through the back door.
export type BaselineState =
  | { kind: "learning"; startedAtMs: number; samples: number[] }
  | { kind: "ready"; baselineMm: number; recent: number[] };

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
        return { kind: "ready", baselineMm, recent: [] };
      }
    }
    return { ...state, samples };
  }

  if (apertureMm === null) {
    return state;
  }
  const recent = pushBounded(state.recent, apertureMm, BASELINE_RECENT_CAP);
  let baselineMm = state.baselineMm;
  if (recent.length >= BASELINE_RISE_MIN_SAMPLES) {
    const candidate = boundedBaseline(recent);
    // The rule of this whole increment: max, never min. The ceiling
    // is inside `candidate`, so a bounded rise that is no longer a
    // rise simply does not happen, and nothing ever falls.
    if (candidate !== null && candidate > baselineMm) {
      baselineMm = candidate;
    }
  }
  return { kind: "ready", baselineMm, recent };
}

// The p90 of a window, held under a multiple of that window's own
// median. Null only when the window is empty.
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
