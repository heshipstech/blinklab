import {
  BASELINE_LEARN_MS,
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
  if (state.kind === "learning") {
    const samples =
      apertureMm === null ? state.samples : [...state.samples, apertureMm];
    const elapsed = nowMs - state.startedAtMs;
    if (
      elapsed >= BASELINE_LEARN_MS &&
      samples.length >= BASELINE_MIN_SAMPLES
    ) {
      const baselineMm = percentile(samples, BASELINE_PERCENTILE);
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
    const candidate = percentile(recent, BASELINE_PERCENTILE);
    // The rule of this whole increment: max, never min.
    if (candidate !== null && candidate > baselineMm) {
      baselineMm = candidate;
    }
  }
  return { kind: "ready", baselineMm, recent };
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
