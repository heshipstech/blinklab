import { describe, expect, it } from "vitest";

import {
  PERCLOS_CLOSED_FRACTION,
  PERCLOS_MIN_OBSERVED_MS,
  emptyPerclos,
  perclosStep,
  perclosValue,
} from "../../src/core/perclos";
import {
  CLOSURE_FRACTIONS,
  emptyPerclosCurve,
  perclosCurve,
  perclosCurveStep,
  perclosCurveValueAt,
  type PerclosCurveState,
} from "../../src/core/perclosCurve";

// Roadmap 12.10. PERCLOS is one line at 40% of baseline; this is the
// honest multi-line version, the eyes-closed share at 60/50/40/30% of
// the frozen baseline. The 40% line IS the existing perclos, and the
// family is ordered loosest-first so the shares read monotone
// non-increasing. Instrument-referenced, never literature P80. The
// score does not read it (12.10's Check: score.ts untouched).

const BASELINE = 10;
// Thirty frames a second, the rate perclos.test.ts feeds: the 60s
// window holds one sample every 33 ms, so a realistic feed clears the
// 100-sample floor where a one-per-second feed never could.
const DT_MS = 1000 / 30;

/**
 * Feed one aperture/baseline series into a fresh curve state at 30 fps,
 * and return the settled state read at the last timestamp.
 */
function feedCurve(apertures: readonly (number | null)[]): {
  state: PerclosCurveState;
  nowMs: number;
} {
  let state = emptyPerclosCurve();
  let t = 0;
  for (const aperture of apertures) {
    state = perclosCurveStep(state, t, aperture, BASELINE);
    t += DT_MS;
  }
  return { state, nowMs: t - DT_MS };
}

// A 120-second series (past the 100-sample and 15-second floors) whose
// apertures land in every band, so each threshold sees a different
// closed share: deep-shut frames count at every line, mid frames only
// at the looser ones. Built so share(0.6) > share(0.5) > share(0.4) >
// share(0.3), a strict order the monotonicity test can lean on.
function bandedSeries(): number[] {
  const bands = [
    2.5, // below 30% of 10 (3.0): closed at every threshold
    3.5, // below 40% (4.0), not 30%: closed at 0.4/0.5/0.6
    4.5, // below 50% (5.0), not 40%: closed at 0.5/0.6
    5.5, // below 60% (6.0), not 50%: closed at 0.6 only
    8.0, // open at every threshold
    8.0,
  ];
  const series: number[] = [];
  // 600 frames at 30 fps is twenty seconds: past the 15-second span and
  // the 100-sample floors, and inside the 60-second window.
  for (let i = 0; i < 600; i += 1) {
    series.push(bands[i % bands.length] as number);
  }
  return series;
}

describe("the closure-fraction family", () => {
  it("names 60/50/40/30 percent, loosest first, with 40 aliased", () => {
    // Loosest first so the exported curve is monotone non-increasing,
    // and 0.4 is perclos.ts's own line rather than a private copy, so
    // the shared point can never drift from the column the score reads.
    expect(CLOSURE_FRACTIONS).toEqual([0.6, 0.5, PERCLOS_CLOSED_FRACTION, 0.3]);
    expect(PERCLOS_CLOSED_FRACTION).toBe(0.4);
  });

  it("is monotone non-increasing on a banded synthetic", () => {
    const { state, nowMs } = feedCurve(bandedSeries());
    const curve = perclosCurve(state, nowMs);
    for (const value of curve) {
      expect(value).not.toBeNull();
    }
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i] as number).toBeLessThanOrEqual(curve[i - 1] as number);
    }
    // And strictly ordered on this series, so the test proves the
    // ordering rather than passing on four equal numbers.
    expect(curve[0] as number).toBeGreaterThan(curve[3] as number);
  });

  it("is monotone even when every frame is shut past the deepest line", () => {
    // A degenerate series where all four shares are equal is still
    // non-increasing; the boundary a naive strict check would fail.
    const { state, nowMs } = feedCurve(Array.from({ length: 600 }, () => 1));
    const curve = perclosCurve(state, nowMs);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i] as number).toBeLessThanOrEqual(curve[i - 1] as number);
    }
    expect(curve.every((v) => v === 1)).toBe(true);
  });

  it("closes strictly below the line, open exactly at it", () => {
    // The same boundary perclos and the long-closure detector share:
    // strictly below the threshold is closed, exactly at it is open.
    // A frame at exactly 40% of baseline is open at 0.4 and 0.3 and
    // closed at the looser 0.5 and 0.6 — the pair that pins < against
    // a <= that would read the line itself as shut.
    const { state, nowMs } = feedCurve(Array.from({ length: 600 }, () => 4.0));
    expect(perclosCurve(state, nowMs)).toEqual([1, 1, 0, 0]);
  });

  it("the 40 percent point is the existing perclos, sample for sample", () => {
    // The whole reason the family imports perclos's line: at 0.4 it
    // must reproduce the column the score reads, byte for byte, over
    // the same feed. A drift here is the family disagreeing with the
    // number it is supposed to contain.
    const apertures = bandedSeries();
    let perclos = emptyPerclos();
    let curve = emptyPerclosCurve();
    let t = 0;
    for (const aperture of apertures) {
      perclos = perclosStep(perclos, t, aperture, BASELINE);
      curve = perclosCurveStep(curve, t, aperture, BASELINE);
      t += 1000;
    }
    const nowMs = t - 1000;
    expect(perclosCurveValueAt(curve, nowMs, PERCLOS_CLOSED_FRACTION)).toBe(
      perclosValue(perclos, nowMs),
    );
  });
});

describe("the family refuses on the same floors as perclos", () => {
  it("refuses until the window holds 100 samples", () => {
    // 99 samples spread evenly across the 15-second span clear the span
    // floor but not the sample floor: the same degenerate window
    // perclos refuses, and the same 100 that makes it answer.
    const sparse = (count: number): PerclosCurveState => {
      let state = emptyPerclosCurve();
      const last = count - 1;
      for (let i = 0; i <= last; i += 1) {
        state = perclosCurveStep(
          state,
          (i * PERCLOS_MIN_OBSERVED_MS) / last,
          2.5,
          BASELINE,
        );
      }
      return state;
    };
    for (const value of perclosCurve(sparse(99), PERCLOS_MIN_OBSERVED_MS)) {
      expect(value).toBeNull();
    }
    for (const value of perclosCurve(sparse(100), PERCLOS_MIN_OBSERVED_MS)) {
      expect(value).toBe(1);
    }
  });

  it("refuses when the newest sample is stale past two seconds", () => {
    const { state, nowMs } = feedCurve(bandedSeries());
    // Read three seconds after the last sample: nothing recent, so the
    // ratio would drift, and perclos withdraws it — so does this.
    for (const value of perclosCurve(state, nowMs + 3000)) {
      expect(value).toBeNull();
    }
  });

  it("skips a frame with no aperture or no baseline, keeping gaps gaps", () => {
    // A null feed joins neither side of the ratio; the surrounding
    // closed frames still count. Fed 120 closed frames with a null
    // every tenth, the shut share stays 1 over the frames that counted.
    let state = emptyPerclosCurve();
    let t = 0;
    for (let i = 0; i < 660; i += 1) {
      const aperture = i % 11 === 10 ? null : 1;
      state = perclosCurveStep(state, t, aperture, BASELINE);
      t += DT_MS;
    }
    const curve = perclosCurve(state, t - DT_MS);
    expect(curve.every((v) => v === 1)).toBe(true);
  });

  it("ignores a backwards clock, leaving the window undisturbed", () => {
    const forward = feedCurve(bandedSeries());
    const back = perclosCurveStep(forward.state, forward.nowMs - 5000, 1, 10);
    expect(back).toBe(forward.state);
  });
});
