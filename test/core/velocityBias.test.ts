import { describe, expect, it } from "vitest";

import {
  VELOCITY_BIAS_DURATIONS_MS,
  VELOCITY_BIAS_FPS,
  VELOCITY_BIAS_PHASES,
  raisedCosineDescent,
  truePeakVelocityMmPerS,
  velocityBiasCell,
  velocityBiasTable,
  worstPublishedRateBias,
} from "../../src/core/velocityBias";

// Roadmap 10.10c4b, ladder B12 (audit F-033). How much of the peak
// closing velocity the frame rate alone takes away.
//
// The prediction was committed before this file existed
// (docs/velocity-sampling-bias.txt, previous commit). These tests are
// that prediction, one assertion each, so a simulation that disagrees
// with what was expected goes red rather than quietly becoming the new
// expectation.
//
// The arithmetic under test is not restated here. The simulation feeds
// its samples to `analyzeClosing`, the function the page itself uses,
// so a change to how the peak is computed moves these numbers instead
// of leaving them describing a function nobody calls.

describe("the descent the simulation samples", () => {
  it("falls from open to shut over its stated duration", () => {
    expect(raisedCosineDescent(7, 7, 100, 0)).toBeCloseTo(7, 9);
    expect(raisedCosineDescent(7, 7, 100, 100)).toBeCloseTo(0, 9);
  });

  it("is symmetric about its midpoint, where its speed peaks", () => {
    const before = raisedCosineDescent(7, 7, 100, 40);
    const after = raisedCosineDescent(7, 7, 100, 60);
    expect(before - 3.5).toBeCloseTo(3.5 - after, 9);
  });

  it("holds still outside the descent", () => {
    expect(raisedCosineDescent(7, 7, 100, -50)).toBe(7);
    expect(raisedCosineDescent(7, 7, 100, 150)).toBe(0);
  });

  it("has the analytic peak velocity the document states", () => {
    // pi * amplitude / (2 * T), the derivative of the raised cosine at
    // its midpoint. Checked against a fine numerical difference rather
    // than against itself.
    const analytic = truePeakVelocityMmPerS(7, 100);
    const step = 0.001;
    const numeric =
      ((raisedCosineDescent(7, 7, 100, 50 - step / 2) -
        raisedCosineDescent(7, 7, 100, 50 + step / 2)) /
        step) *
      1000;
    expect(analytic).toBeCloseTo(numeric, 3);
    expect(analytic).toBeCloseTo((Math.PI * 7) / (2 * 0.1), 9);
  });
});

describe("the prediction, held to the simulation", () => {
  const table = velocityBiasTable();

  it("covers the rates and durations the document fixed", () => {
    // The floor. An empty table would make every assertion below run
    // over nothing and report success.
    expect(table.length).toBe(
      VELOCITY_BIAS_FPS.length * VELOCITY_BIAS_DURATIONS_MS.length,
    );
    expect(VELOCITY_BIAS_FPS).toContain(25);
    expect(VELOCITY_BIAS_FPS).toContain(240);
    expect(VELOCITY_BIAS_PHASES).toBeGreaterThan(8);
  });

  it("1. never reads faster than the truth, at any rate or phase", () => {
    // A positive bias anywhere means the simulation or the arithmetic
    // is wrong, not that a sampler got lucky: no sampling of a smooth
    // descent can exceed its own peak derivative.
    for (const cell of table) {
      expect(
        cell.best,
        `${cell.fps} fps, ${cell.closingMs} ms`,
      ).toBeGreaterThanOrEqual(0);
      expect(cell.worst).toBeGreaterThanOrEqual(cell.median);
      expect(cell.median).toBeGreaterThanOrEqual(cell.best);
    }
  });

  it("2. WAS WRONG below: the band is 5 to 40 percent, not 10 to 40", () => {
    // The prediction said the median underestimate would land between
    // 10 and 40 percent at these rates over these durations. It lands
    // between 5.4 and 36.8. The upper half held; the floor did not,
    // and the reason is worth keeping.
    //
    // I estimated the loss as if one sampling interval were placed
    // wherever it fell. `analyzeClosing` takes the LARGEST drop among
    // all adjacent pairs on the descent, so it already picks the
    // best-placed interval available at that phase, and the loss is
    // smaller than a fixed-interval estimate suggests. The longest
    // descent at the slowest rate — 120 ms at 25 fps, the cell with
    // the most intervals to choose between — is where that shows.
    //
    // The prediction stands as written in the document. This assertion
    // is the measurement.
    const published = table.filter(
      (cell) => cell.fps === 25 || cell.fps === 30,
    );
    expect(published.length).toBe(2 * VELOCITY_BIAS_DURATIONS_MS.length);
    for (const cell of published) {
      expect(
        cell.median,
        `${cell.fps} fps, ${cell.closingMs} ms`,
      ).toBeGreaterThan(0.05);
      expect(cell.median).toBeLessThan(0.4);
    }
  });

  it("2. a fifty millisecond blink can lose most of its peak", () => {
    // The number the prose carries, and the one that made the row
    // worth doing: at 25 frames per second a short blink's published
    // velocity can be under half its truth.
    const cell = velocityBiasCell(25, 50);
    expect(cell.worst).toBeGreaterThan(0.5);
    expect(cell.median).toBeGreaterThan(0.3);
  });

  it("2. contains the band the audit reproduced, 12 to 28 percent", () => {
    // If this fails the audit and this simulation disagree, and the
    // row stops to find out why rather than publishing either.
    const published = table.filter(
      (cell) => cell.fps === 25 || cell.fps === 30,
    );
    const medians = published.map((cell) => cell.median);
    expect(Math.min(...medians)).toBeLessThanOrEqual(0.12);
    expect(Math.max(...medians)).toBeGreaterThanOrEqual(0.28);
  });

  it("3. grows as the descent shortens and the interval lengthens", () => {
    for (const fps of VELOCITY_BIAS_FPS) {
      const byDuration = VELOCITY_BIAS_DURATIONS_MS.map(
        (closingMs) => velocityBiasCell(fps, closingMs).median,
      );
      for (let i = 1; i < byDuration.length; i += 1) {
        expect(byDuration[i], `${fps} fps`).toBeLessThanOrEqual(
          byDuration[i - 1] as number,
        );
      }
    }
    for (const closingMs of VELOCITY_BIAS_DURATIONS_MS) {
      const byRate = VELOCITY_BIAS_FPS.map(
        (fps) => velocityBiasCell(fps, closingMs).median,
      );
      for (let i = 1; i < byRate.length; i += 1) {
        expect(byRate[i], `${closingMs} ms`).toBeLessThanOrEqual(
          byRate[i - 1] as number,
        );
      }
    }
  });

  it("4. nearly vanishes at 240 frames per second", () => {
    // The control. A simulation whose bias survives a rate this far
    // above anything the project runs is measuring its own mistake.
    for (const closingMs of VELOCITY_BIAS_DURATIONS_MS) {
      expect(velocityBiasCell(240, closingMs).median).toBeLessThan(0.02);
    }
  });

  it("5. moves the ratio the same way drowsiness does", () => {
    // Amplitude survives sampling and velocity does not, so the ratio
    // published as a drowsiness time constant reads LONGER on a slow
    // machine. Stated as a prediction before it was run, because it is
    // the finding this row exists for.
    const cell = velocityBiasCell(25, 80);
    expect(cell.ratioInflation).toBeGreaterThan(1);
    // 1/(1-b) within a hair: amplitude's own loss is second order.
    expect(cell.ratioInflation).toBeCloseTo(1 / (1 - cell.median), 1);
  });

  it("names one worst number the documents can quote", () => {
    // A single figure for the prose to carry, taken from the table
    // rather than typed beside it.
    const worst = worstPublishedRateBias();
    expect(worst).toBe(
      Math.max(
        ...table
          .filter((cell) => cell.fps === 25 || cell.fps === 30)
          .map((cell) => cell.worst),
      ),
    );
    expect(worst).toBeGreaterThan(0.2);
  });
});
