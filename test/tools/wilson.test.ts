import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import { intervalPercent, wilsonInterval } from "../../tools/wilson.mjs";

// Roadmap 10.10c1, ladder B8. The document side of the interval
// arithmetic, held to the same numbers as the measuring side.
//
// `analysis/blinklab/stats.py` computes these for the tools that run
// over a corpus; this computes them for the README block, which is
// generated from the counts those tools published. Two implementations
// of one formula is exactly what this repository keeps finding fault
// with, so both read `test/fixtures/wilson-cases.json` and recompute
// it. A formula agreed in prose and disagreed in arithmetic is what
// that table exists to catch.
//
// The two are not bit-identical and are not asked to be. Python takes
// the normal quantile from its standard library; this side computes it
// by bisection over a published series for the error function, good to
// about seven digits. The tolerance below is 1e-6, which is five
// orders of magnitude finer than the one decimal any published
// sentence shows.

const root = repoRoot();

type Case = {
  successes: number;
  trials: number;
  confidence: number;
  low: number;
  high: number;
};

const CASES = JSON.parse(
  readRepoFile("test/fixtures/wilson-cases.json", root),
) as Case[];

describe("the interval agrees with the analysis track", () => {
  it("has a table with the published cases in it", () => {
    // The floor. An empty table would make the loop below assert
    // nothing while reporting success.
    expect(CASES.length).toBeGreaterThan(8);
    expect(
      CASES.some((entry) => entry.successes === 341 && entry.trials === 408),
      "the recall headline must be among the cases",
    ).toBe(true);
    expect(
      CASES.some((entry) => entry.successes === 0),
      "a zero count must be among the cases",
    ).toBe(true);
  });

  for (const entry of CASES) {
    it(`reproduces ${String(entry.successes)} of ${String(entry.trials)} at ${String(entry.confidence)}`, () => {
      const [low, high] = wilsonInterval(
        entry.successes,
        entry.trials,
        entry.confidence,
      );
      expect(low).toBeCloseTo(entry.low, 6);
      expect(high).toBeCloseTo(entry.high, 6);
    });
  }
});

describe("the interval says what a count supports", () => {
  it("reproduces the published recall interval", () => {
    expect(intervalPercent(341, 408)).toBe("79.7 to 86.9");
  });

  it("gives a zero count an upper bound rather than certainty", () => {
    // The case that made this row. The normal approximation on 0 of 3
    // is exactly [0, 0]: three observations reported as certainty.
    expect(intervalPercent(0, 3)).toBe("0.0 to 56.1");
  });

  it("gives a perfect count a lower bound", () => {
    expect(intervalPercent(3, 3)).toBe("43.9 to 100.0");
  });

  it("narrows as the trials grow", () => {
    const [narrowLow, narrowHigh] = wilsonInterval(800, 1000);
    const [wideLow, wideHigh] = wilsonInterval(8, 10);
    expect(narrowHigh - narrowLow).toBeLessThan(wideHigh - wideLow);
  });

  it("refuses what is not a proportion", () => {
    expect(() => wilsonInterval(0, 0)).toThrow();
    expect(() => wilsonInterval(5, 3)).toThrow();
    expect(() => wilsonInterval(1, 2, 1)).toThrow();
  });
});
