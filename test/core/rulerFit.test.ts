import { describe, expect, it } from "vitest";

import { describeCalibrationWindow } from "../../src/core/calibrationWindow";
import { FEATURE_RECORD_CAP } from "../../src/core/featureRecord";
import {
  BASELINE_OVER_RESTING_CEILING,
  RULER_FIT_DWELL_RECORDS,
  describeRulerFit,
  initialRulerFitState,
  restingMedianMm,
  rulerFitMessage,
  rulerFitStep,
  type RulerFitState,
} from "../../src/core/rulerFit";

// The live half of the validation round's fifth check. The Python
// side (analysis/blinklab/validation_checks.py) judges a finished
// file; this judges the same ratio while the session is running, so
// a macbookair-shaped ruler is named on the page it happens on
// instead of days later in a table. The two sides must agree on the
// ceiling, on the median, and on WHICH frames count, and every one
// of those agreements is pinned below.

function fed(
  apertures: readonly (number | null)[],
  baselineMm: number | null,
): RulerFitState {
  let state = initialRulerFitState;
  for (const apertureMm of apertures) {
    state = rulerFitStep(state, apertureMm, baselineMm);
  }
  return state;
}

describe("the round's six published ratios, reproduced", () => {
  // docs/validation-round.txt, the baseline / resting column. The
  // raw CSVs are not in this repository, so these are not replays:
  // each published ratio is reconstructed as a constant-aperture
  // session whose baseline is that multiple of it, and the verdict
  // must land where the round's table put it. P6 is the row that
  // matters most: 1.23 was the round's narrowest escape, two
  // hundredths under the ceiling, and it decided that criterion 1
  // could be evaluated at all. A ceiling nudged down (1.2 flags P6
  // and P1) rewrites the round; the strictness of the comparison is
  // pinned separately at the boundary below, since no published
  // ratio sits exactly on the line.
  const published: [string, number, "fits" | "tooLong"][] = [
    ["P1", 1.19, "fits"],
    ["P2", 1.09, "fits"],
    ["P3", 1.33, "tooLong"],
    ["P4", 1.1, "fits"],
    ["P5", 1.28, "tooLong"],
    ["P6", 1.23, "fits"],
  ];

  for (const [label, ratio, verdict] of published) {
    it(`${label}: ${String(ratio)} is ${verdict}`, () => {
      const restingMm = 6.0;
      const state = fed(Array(40).fill(restingMm), ratio * restingMm);
      const fit = describeRulerFit(state, ratio * restingMm);
      expect(fit).not.toBeNull();
      expect(fit?.ratio).toBeCloseTo(ratio, 9);
      expect(fit?.verdict).toBe(verdict);
    });
  }
});

describe("the ceiling", () => {
  it("is the plan's own 1.25, the same number the Python check holds", () => {
    // analysis/blinklab/validation_checks.py:59. The cross-language
    // pin lives on the Python side, in test_csv_contract.py, which
    // reads this constant out of the TypeScript source; this test
    // only keeps the number from moving without a diff here too.
    expect(BASELINE_OVER_RESTING_CEILING).toBe(1.25);
  });

  it("at the ceiling exactly still fits, strictly above does not", () => {
    // Python: `over_resting > BASELINE_OVER_RESTING_CEILING`. Strict.
    // 5.0 / 4.0 is exactly 1.25 in floating point, so this boundary
    // is exact, not a tolerance.
    const at = describeRulerFit(fed(Array(10).fill(4.0), 5.0), 5.0);
    expect(at?.ratio).toBe(1.25);
    expect(at?.verdict).toBe("fits");
    const above = describeRulerFit(fed(Array(10).fill(4.0), 5.0001), 5.0001);
    expect(above?.verdict).toBe("tooLong");
  });
});

describe("the resting median matches the published check's median", () => {
  it("averages the two middle values on an even count, as pandas does", () => {
    // The check computes `apertures.median()` with pandas, which
    // interpolates: median of [6, 7] is 6.5. The repository's own
    // percentile() is nearest-rank and would say 6, which is why
    // rulerFit carries its own median: swapping percentile(50) in
    // turns this red, and the final row of a session would stop
    // agreeing with the table the round published.
    expect(restingMedianMm([6, 7])).toBe(6.5);
    expect(restingMedianMm([6, 7, 9])).toBe(7);
    expect(restingMedianMm([1, 2, 3, 4])).toBe(2.5);
  });

  it("ignores nulls, and an all-null series has no median", () => {
    expect(restingMedianMm([null, 6, null])).toBe(6);
    expect(restingMedianMm([null, null])).toBeNull();
    expect(restingMedianMm([])).toBeNull();
  });
});

describe("the median is over ALL records, deliberately", () => {
  it("keeps the closed-eye frames the blink line would filter out", () => {
    // The Python check's stated choice (validation_checks.py,
    // baseline_settling docstring): filtering by the blink line
    // would use the baseline to choose the frames that judge the
    // baseline. This series is P5's shape, the session whose long
    // closures inside the window dragged its median down and pushed
    // its ratio over the line. The correct computation flags it; the
    // circular one would clear it. A mutation that filters
    // sub-blink-line apertures out of the median flips this verdict.
    const apertures = [2, 2, 2, 2, 5.8, 6.0, 6.0, 6.2, 6.2, 6.4];
    const baselineMm = 7.5;
    const fit = describeRulerFit(fed(apertures, baselineMm), baselineMm);
    expect(fit?.restingMedianMm).toBeCloseTo(5.9, 9);
    expect(fit?.ratio).toBeCloseTo(7.5 / 5.9, 9);
    expect(fit?.verdict).toBe("tooLong");

    // The circular alternative, computed here so the difference is a
    // fact in the test rather than a claim in a comment: open-eye
    // frames only (blink line is half of 7.5) give a median of 6.1
    // and a ratio under the ceiling.
    const openOnly = apertures.filter((a) => a >= baselineMm / 2);
    const circular = baselineMm / (restingMedianMm(openOnly) ?? NaN);
    expect(circular).toBeLessThan(BASELINE_OVER_RESTING_CEILING);
  });
});

describe("the spoken verdict holds still while the median wobbles", () => {
  // The ratio is a running statistic and 1.25 is a line, so a
  // session sitting near the line (P6 lived at 1.23) would flap a
  // naive verdict every few seconds. The instantaneous verdict is
  // still what describeRulerFit returns; what the page SAYS only
  // moves after the instantaneous verdict has disagreed with it for
  // RULER_FIT_DWELL_RECORDS consecutive records.
  const baselineMm = 7.44;

  it("speaks immediately when the first verdict arrives", () => {
    const state = rulerFitStep(initialRulerFitState, 6.0, 9.0);
    expect(state.shown).toBe("tooLong");
  });

  it("a one-record excursion does not flip it", () => {
    // Seeded 6.2 first so the FIRST record already fits (the first
    // verdict speaks immediately), then at median 6.0 (ratio 1.24,
    // fits) alternating appends walk the median between 5.8 (ratio
    // 1.283, tooLong) and 6.0. Every excursion lasts one record, so
    // the shown verdict must never move.
    let state = fed([6.2, 5.8], baselineMm);
    expect(state.shown).toBe("fits");
    for (let i = 0; i < 10; i += 1) {
      state = rulerFitStep(state, 5.8, baselineMm);
      expect(describeRulerFit(state, baselineMm)?.verdict).toBe("tooLong");
      expect(state.shown).toBe("fits");
      state = rulerFitStep(state, 6.2, baselineMm);
      expect(state.shown).toBe("fits");
    }
  });

  it("a sustained crossing flips it exactly once, on the dwell's last record", () => {
    let state = fed([6.2, 5.8], baselineMm);
    expect(state.shown).toBe("fits");
    for (let i = 1; i < RULER_FIT_DWELL_RECORDS; i += 1) {
      state = rulerFitStep(state, 5.6, baselineMm);
      expect(state.shown).toBe("fits");
    }
    state = rulerFitStep(state, 5.6, baselineMm);
    expect(state.shown).toBe("tooLong");
  });
});

describe("nothing is said before there is something to say", () => {
  it("no baseline, no verdict; the samples still accumulate", () => {
    // The published median is over the WHOLE file, learning window
    // included, so records must count from the first one even
    // though no ratio exists until the baseline is born.
    let state = fed([6.0, 6.0, 6.0], null);
    expect(describeRulerFit(state, null)).toBeNull();
    expect(state.shown).toBeNull();
    state = rulerFitStep(state, 6.0, 6.6);
    const fit = describeRulerFit(state, 6.6);
    expect(fit?.sampleCount).toBe(4);
    expect(fit?.ratio).toBeCloseTo(1.1, 9);
  });

  it("null apertures hold a place but join no median", () => {
    const state = fed([null, 6.0, null], 6.6);
    const fit = describeRulerFit(state, 6.6);
    expect(fit?.sampleCount).toBe(1);
    expect(fit?.restingMedianMm).toBe(6.0);
  });

  it("an empty session has no fit at all", () => {
    expect(describeRulerFit(initialRulerFitState, 7.5)).toBeNull();
  });
});

describe("the accumulator is bounded exactly like the export", () => {
  it("mirrors the feature record cap, dropping the oldest record", () => {
    // The Python check reads the FILE, and the file holds the last
    // FEATURE_RECORD_CAP rows, so a live series that remembered
    // more would diverge from the published statistic in any
    // session longer than the buffer. The state is built by hand
    // here because stepping 3600 times to prove a slice is all
    // cost and no evidence.
    expect(FEATURE_RECORD_CAP).toBe(3600);
    const full: RulerFitState = {
      apertures: [
        1.0,
        ...(Array(FEATURE_RECORD_CAP - 1).fill(6.0) as number[]),
      ],
      shown: "fits",
      pendingRun: 0,
    };
    const state = rulerFitStep(full, 6.0, 7.0);
    expect(state.apertures.length).toBe(FEATURE_RECORD_CAP);
    expect(state.apertures[0]).toBe(6.0);
  });
});

describe("a macbookair-shaped birth is still flagged, live", () => {
  it("the birth clip alone did not fix that session, and this names it", () => {
    // Increment A's clip bounds the BIRTH at 1.25 times the learning
    // window's own median, but the macbookair failure's window
    // median (7.51) was itself inflated relative to the session's
    // resting eye (about 6.93, the same face's cross-device median).
    // So the clipped birth, 9.3875, still stands at 1.35 times
    // resting: the clip narrowed the failure and only this check
    // names it while it is happening.
    const learningFrames = [
      ...(Array(89).fill(7.51) as number[]),
      ...(Array(11).fill(10.35) as number[]),
    ];
    const window = describeCalibrationWindow(learningFrames);
    expect(window?.baselineMm).toBeCloseTo(9.3875, 9);
    const baselineMm = window?.baselineMm ?? NaN;
    const state = fed(Array(60).fill(6.93), baselineMm);
    const fit = describeRulerFit(state, baselineMm);
    expect(fit?.ratio).toBeCloseTo(1.3546, 3);
    expect(fit?.verdict).toBe("tooLong");
    expect(state.shown).toBe("tooLong");
  });
});

describe("the sentence the page prints", () => {
  it("waits out loud before the baseline", () => {
    expect(rulerFitMessage(fed([6.0], null), null)).toBe(
      "Ruler fit: waiting for the baseline",
    );
  });

  it("states the ratio and the ceiling, and claims nothing while it fits", () => {
    // The ratio in the sentence is instantaneous and the verdict is
    // dwelled, so for up to the dwell the two can disagree. The
    // fitting sentence therefore never asserts "under the ceiling":
    // it shows both numbers and lets them speak, so the page cannot
    // print "1.27 x" and "under 1.25" in the same breath.
    const state = fed(Array(10).fill(6.0), 7.14);
    expect(rulerFitMessage(state, 7.14)).toBe(
      "Ruler fit: baseline is 1.19 x your resting eye (ceiling 1.25)",
    );
  });

  it("names a too-long ruler in words once the verdict has settled", () => {
    const state = fed(Array(10).fill(6.0), 8.4);
    expect(rulerFitMessage(state, 8.4)).toBe(
      "Ruler fit: baseline is 1.40 x your resting eye, too long to trust (ceiling 1.25)",
    );
  });
});
