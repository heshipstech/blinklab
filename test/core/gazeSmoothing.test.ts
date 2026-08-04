import { describe, expect, it } from "vitest";

import {
  axisFilterStep,
  gazeSmoothingStep,
  MIN_CUTOFF_HZ,
  smoothingFactor,
  type AxisFilterState,
  type GazeSmoothingState,
} from "../../src/core/gazeSmoothing";

// A steady camera pace: the filter is time-aware, so the tests fix
// the clock at 30 frames per second and never rely on wall time.
const DT_MS = 1000 / 30;

// The ladder's tolerance, written once: after a step, the smoothed
// value must cover at least 90 percent of the jump within 150 ms.
const STEP_BUDGET_MS = 150;
const STEP_COVERAGE = 0.9;

function runAxis(
  values: readonly number[],
  startMs = 0,
): { states: AxisFilterState[]; last: AxisFilterState } {
  const states: AxisFilterState[] = [];
  let state: AxisFilterState | null = null;
  values.forEach((value, i) => {
    state = axisFilterStep(state, startMs + i * DT_MS, value);
    states.push(state);
  });
  if (state === null) {
    throw new Error("runAxis needs at least one sample");
  }
  return { states, last: state };
}

// A tiny seeded generator so the noise test is the same on every
// machine and every run. Not cryptography, only repeatability.
function seededNoise(count: number, amplitude: number): number[] {
  let seed = 42;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out.push((seed / 2147483648 - 0.5) * 2 * amplitude);
  }
  return out;
}

function standardDeviation(values: readonly number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  return Math.sqrt(variance);
}

describe("axisFilterStep, the One Euro filter per axis", () => {
  it("passes the very first sample through unchanged", () => {
    const state = axisFilterStep(null, 0, 0.12);
    expect(state.value).toBe(0.12);
  });

  it("holds a constant input exactly, no drift", () => {
    const { last } = runAxis(Array<number>(60).fill(0.1));
    expect(last.value).toBeCloseTo(0.1, 12);
  });

  it("ignores a sample whose clock did not advance", () => {
    const first = axisFilterStep(null, 0, 0.1);
    const second = axisFilterStep(first, DT_MS, 0.2);
    const stuck = axisFilterStep(second, DT_MS, 0.9);
    expect(stuck).toBe(second);
  });

  it("shrinks jitter while the eye holds still", () => {
    const noise = seededNoise(300, 0.005);
    const raw = noise.map((n) => 0.1 + n);
    const { states } = runAxis(raw);
    // Skip the first second of warm up, then compare spreads.
    const rawTail = raw.slice(30);
    const smoothedTail = states.slice(30).map((s) => s.value);
    const ratio = standardDeviation(smoothedTail) / standardDeviation(rawTail);
    expect(ratio).toBeLessThan(0.5);
  });

  it("covers a step within the budget, in both directions", () => {
    const budgetFrames = Math.floor(STEP_BUDGET_MS / DT_MS);
    for (const stepTo of [0.2, -0.2]) {
      const values = [
        ...Array<number>(30).fill(0),
        ...Array<number>(budgetFrames).fill(stepTo),
      ];
      const { last } = runAxis(values);
      const covered = Math.abs(last.value) / Math.abs(stepTo);
      expect(covered).toBeGreaterThanOrEqual(STEP_COVERAGE);
    }
  });

  it("counterfactual: a fixed filter with the same calm smoothing misses the budget", () => {
    // The adaptive filter's strength when calm IS the minimum cutoff,
    // so a fixed filter built from that cutoff smooths jitter equally
    // well. Fed the same step for the same budget, it must fall short:
    // that gap is the entire reason the filter adapts.
    const alpha = smoothingFactor(MIN_CUTOFF_HZ, DT_MS / 1000);
    const budgetFrames = Math.floor(STEP_BUDGET_MS / DT_MS);
    let value = 0;
    for (let i = 0; i < budgetFrames; i++) {
      value = value + alpha * (0.2 - value);
    }
    expect(value / 0.2).toBeLessThan(STEP_COVERAGE);
  });
});

describe("gazeSmoothingStep, the two axis wrapper", () => {
  it("smooths both axes independently", () => {
    let state: GazeSmoothingState | null = null;
    let smoothed = null;
    // Vertical holds still while horizontal steps: only horizontal
    // may move, the axes must not leak into each other.
    for (let i = 0; i < 40; i++) {
      const horizontal = i < 20 ? 0 : 0.2;
      const result = gazeSmoothingStep(state, i * DT_MS, {
        horizontal,
        vertical: 0.05,
      });
      state = result.state;
      smoothed = result.smoothed;
    }
    expect(smoothed).not.toBeNull();
    if (smoothed !== null) {
      expect(smoothed.vertical).toBeCloseTo(0.05, 12);
      expect(smoothed.horizontal).toBeGreaterThan(0.18);
    }
  });

  it("outputs null on a null input and forgets its history", () => {
    let state: GazeSmoothingState | null = null;
    for (let i = 0; i < 30; i++) {
      state = gazeSmoothingStep(state, i * DT_MS, {
        horizontal: 0.1,
        vertical: 0.1,
      }).state;
    }
    const gap = gazeSmoothingStep(state, 30 * DT_MS, null);
    expect(gap.smoothed).toBeNull();
    expect(gap.state).toBeNull();

    // After the gap, the filter restarts at the new raw value: stale
    // history from before the gap must not drag the fresh signal.
    const fresh = gazeSmoothingStep(gap.state, 31 * DT_MS, {
      horizontal: -0.2,
      vertical: -0.2,
    });
    expect(fresh.smoothed).toEqual({ horizontal: -0.2, vertical: -0.2 });
  });
});
