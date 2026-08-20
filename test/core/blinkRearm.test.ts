import { describe, expect, it } from "vitest";

import { blinkStep, initialBlinkState } from "../../src/core/blink";
import { APERTURE_HYSTERESIS_FRACTION } from "../../src/core/constants";

// The re-arm gate's experiment, docs/blink-rearm.txt, predictions
// committed before this file existed. The validation round's P1
// produced 25 detections for 10 deliberate blinks: their slow, deep
// reopen hovers near the blink line and wobbles past the arm line,
// which sits only 10 percent under it, so one blink minted several
// counts 200 to 270 ms apart, outside the refractory period's reach.
//
// The gate: after a COUNTED blink, no new closure may arm until the
// aperture has risen 10 percent ABOVE the line, symmetric to the arm
// line below it. The eyelid must actually reopen before it can blink
// again. Unlike the reopen latch fix #114's review killed, this moves
// neither the closing nor the reopening line, so durations keep their
// definition untouched.

const OPEN = 7.7;
const THRESHOLD = 3.85;

/** Piecewise linear aperture from (ms, mm) knots. */
function trace(knots: [number, number][]): (tMs: number) => number {
  return (tMs) => {
    const first = knots[0];
    const last = knots[knots.length - 1];
    if (first === undefined || last === undefined) return OPEN;
    if (tMs <= first[0]) return first[1];
    if (tMs >= last[0]) return last[1];
    for (let i = 1; i < knots.length; i += 1) {
      const a = knots[i - 1];
      const b = knots[i];
      if (a !== undefined && b !== undefined && tMs <= b[0]) {
        const share = (tMs - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * share;
      }
    }
    return last[1];
  };
}

/** Run a trace past the real detector at a rate and phase. */
function countAt(
  aperture: (tMs: number) => number,
  totalMs: number,
  rateHz: number,
  phaseMs: number,
): number {
  let state = initialBlinkState;
  const stepMs = 1000 / rateHz;
  for (let t = phaseMs; t <= totalMs; t += stepMs) {
    state = blinkStep(state, t, aperture(t), THRESHOLD);
  }
  return state.blinkCount;
}

const RATES = [25, 30, 45, 60, 90];
function phasesFor(rateHz: number): number[] {
  const stepMs = 1000 / rateHz;
  return Array.from({ length: 7 }, (_, i) => (stepMs * i) / 7);
}

// Trace R, the P1 shape: one deep blink whose slow reopen peaks
// BETWEEN the blink line and the re-arm line, then sags below the arm
// line again before finally reopening. The second line-crossing lands
// about 320 ms after the first, far outside the 150 ms refractory
// period, and its dip to 2.6 mm is well past the arm line, so before
// the gate this counted 2. Every critical window spans at least two
// sample intervals at 25 Hz, so no phase can miss it.
const traceR = trace([
  [0, OPEN],
  [100, 1.5],
  [330, 4.1],
  [470, 4.1],
  [590, 2.6],
  [740, OPEN],
  [900, OPEN],
]);

// Trace D, a genuine double blink: two full, deep blinks whose lid
// returns all the way to open in between, 400 ms apart. The gate must
// never eat this, at any rate or phase, or it trades one defect for
// another and does not ship. That is the decision rule.
const traceD = trace([
  [0, OPEN],
  [80, 1.2],
  [230, OPEN],
  [400, OPEN],
  [480, 1.2],
  [630, OPEN],
  [800, OPEN],
]);

// Trace P, the boundary: a genuine double blink whose lid reopens
// only into the band between the two lines. The gate counts 1 here,
// and that cost was accepted in the predictions before this ran: the
// band is a nearly-shut eye, where PERCLOS and the long-closure
// detector are the instruments and a blink count is already dubious.
const traceP = trace([
  [0, OPEN],
  [80, 1.2],
  [230, 4.1],
  [400, 4.1],
  [480, 1.2],
  [630, OPEN],
  [800, OPEN],
]);

describe("the re-arm gate (docs/blink-rearm.txt)", () => {
  it("counts the P1 re-crossing shape ONCE, at every rate and phase", () => {
    for (const rate of RATES) {
      for (const phase of phasesFor(rate)) {
        expect(
          countAt(traceR, 900, rate, phase),
          `rate ${String(rate)} phase ${phase.toFixed(1)}`,
        ).toBe(1);
      }
    }
  });

  it("never eats a genuine double blink, at any rate or phase", () => {
    // The decision rule from the predictions: if this test can fail,
    // the gate does not ship.
    for (const rate of RATES) {
      for (const phase of phasesFor(rate)) {
        expect(
          countAt(traceD, 800, rate, phase),
          `rate ${String(rate)} phase ${phase.toFixed(1)}`,
        ).toBe(2);
      }
    }
  });

  it("counts a band-reopen double as one, the accepted cost", () => {
    for (const rate of RATES) {
      for (const phase of phasesFor(rate)) {
        expect(
          countAt(traceP, 800, rate, phase),
          `rate ${String(rate)} phase ${phase.toFixed(1)}`,
        ).toBe(1);
      }
    }
  });

  it("leaves durations exactly where the crossings put them", () => {
    // The gate touches arming only. At a 1 kHz reference the counted
    // durations must match the analytic threshold crossings of trace
    // D: close at 447.4 ms, reopen at 541.2 ms, a 93.8 ms closed
    // phase, within one sample step.
    let state = initialBlinkState;
    for (let t = 0; t <= 800; t += 1) {
      state = blinkStep(state, t, traceD(t), THRESHOLD);
    }
    expect(state.blinkCount).toBe(2);
    expect(state.lastBlinkDurationMs).not.toBeNull();
    if (state.lastBlinkDurationMs !== null) {
      expect(Math.abs(state.lastBlinkDurationMs - 93.8)).toBeLessThan(2);
    }
  });

  it("the re-arm line sits symmetric to the arm line", () => {
    // Pinned so the gate cannot quietly drift apart from fix #114's
    // hysteresis: one shared constant, one band, both sides.
    expect(APERTURE_HYSTERESIS_FRACTION).toBe(0.1);
  });
});
