import { describe, expect, it } from "vitest";

import {
  SAMPLING_BOUND_DRAWS,
  SAMPLING_BOUND_FPS,
  SAMPLING_BOUND_FRACTIONS,
  SAMPLING_BOUND_SEED,
  SAMPLING_WINDOW_S,
  WORST_PERCLOS_SAMPLING_BOUND,
  blinkCountConditionsSentence,
  generateClosures,
  lcg,
  perclosConditionsSentence,
  sampledClosedFraction,
  samplingBoundsTable,
  trueClosedFraction,
} from "../../src/core/samplingBounds";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.10a. PERCLOS is a fraction read off regularly spaced
// samples, and nothing said how wrong that fraction can be purely
// from the sampling. The sweep here is seeded and deterministic, so
// the committed table in docs/sampling-bounds.txt reproduces bit for
// bit, and the last test holds the doc to a recomputation on every
// run. The prediction was committed before any cell was computed —
// commit order is the proof.

describe("the seeded generator", () => {
  it("is deterministic and stays inside [0, 1)", () => {
    const a = lcg(42);
    const b = lcg(42);
    for (let i = 0; i < 100; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("different seeds diverge", () => {
    expect(lcg(1)()).not.toBe(lcg(2)());
  });
});

describe("the closure generator", () => {
  it("hits the target fraction exactly, without overlaps, in order", () => {
    const closures = generateClosures(lcg(7), SAMPLING_WINDOW_S, 0.15);
    expect(trueClosedFraction(closures, SAMPLING_WINDOW_S)).toBeCloseTo(
      0.15,
      9,
    );
    expect(closures.length).toBeGreaterThanOrEqual(2);
    expect(closures.length).toBeLessThanOrEqual(10);
    for (let i = 0; i < closures.length; i += 1) {
      const closure = closures[i];
      expect(closure).toBeDefined();
      expect((closure as { startS: number }).startS).toBeGreaterThanOrEqual(0);
      if (i > 0) {
        expect((closure as { startS: number }).startS).toBeGreaterThanOrEqual(
          (closures[i - 1] as { endS: number }).endS,
        );
      }
    }
    const last = closures[closures.length - 1];
    expect((last as { endS: number }).endS).toBeLessThanOrEqual(
      SAMPLING_WINDOW_S,
    );
  });
});

describe("the sampler", () => {
  it("counts exactly the samples that land inside closures", () => {
    // Window 10 s, one closure [2, 4), 1 fps, phase 0: samples at
    // 0..9, inside at t=2 and t=3, so 2 of 10.
    const fraction = sampledClosedFraction([{ startS: 2, endS: 4 }], 10, 1, 0);
    expect(fraction).toBeCloseTo(0.2, 12);
  });

  it("moves with the phase, which is the whole phenomenon", () => {
    // The same closure sampled at phase 0.5 lands 2 samples (2.5,
    // 3.5); at phase 0.99 it still lands 2 (2.99, 3.99); a closure
    // shorter than a period can land 0 or 1 depending on phase.
    const shortClosure = [{ startS: 2.1, endS: 2.9 }];
    expect(sampledClosedFraction(shortClosure, 10, 1, 0)).toBe(0);
    expect(sampledClosedFraction(shortClosure, 10, 1, 0.5)).toBeCloseTo(
      0.1,
      12,
    );
  });
});

describe("the on-page conditions sentences (roadmap 10.10b)", () => {
  it("the worst-bound constant is the committed table's own maximum", () => {
    // Parsed from the doc, not re-swept: the sweep already guards the
    // table, and this pins the sentence's number to that table's worst
    // cell so neither can move alone.
    const doc = readRepoFile("docs/sampling-bounds.txt", repoRoot());
    const bounds = [...doc.matchAll(/p95 (0\.\d{4})/g)].map((match) =>
      Number(match[1]),
    );
    expect(bounds.length).toBeGreaterThanOrEqual(12);
    expect(Math.max(...bounds)).toBe(WORST_PERCLOS_SAMPLING_BOUND);
  });

  it("the PERCLOS sentence quotes its document and scopes its claim", () => {
    const sentence = perclosConditionsSentence();
    expect(sentence).toContain("sampling term");
    expect(sentence).toContain("±0.002");
    expect(sentence).toContain("15 frames per second");
    expect(sentence).toContain("docs/sampling-bounds.txt");
    // The number's REAL conditions, named so the negligible term does
    // not read as "this number is exact".
    expect(sentence).toContain("shut line");
    expect(sentence).toContain("docs/aperture-noise-floor.txt");
  });

  it("the PERCLOS sentence says which closures its bound covers", () => {
    // Roadmap 10.10c4a, ladder B12 (audit F-090). The simulation draws
    // closures between MIN_CLOSURE_S and MAX_CLOSURE_S, half a second
    // and up. An ordinary blink is shorter than that and the
    // instrument-adjusted shut line counts it as closed time, so the
    // published share contains a population the bound never sampled —
    // and shorter closures are exactly the ones a slow frame rate
    // misjudges most. The sentence claimed the bound for the whole
    // share.
    const sentence = perclosConditionsSentence();
    expect(sentence).toContain("half a second");
    expect(sentence).toContain("blink");
  });

  it("the stated scope is the range the simulation actually drew", () => {
    // The source pin. Lowering the simulated floor without rewriting
    // the sentence would leave a scope that describes nothing, which
    // is the failure this whole run of increments keeps meeting.
    const source = readRepoFile("src/core/samplingBounds.ts", repoRoot());
    expect(source).toContain("const MIN_CLOSURE_S = 0.5;");
  });

  it("PERCLOS says in its own module that it counts blink time", () => {
    // Ladder B12 (audit F-029). The literature's PERCLOS excludes
    // blink frames; this one cannot, because the shut line it shares
    // with the long-closure detector is crossed by every full blink.
    // A number that means something different from the number it is
    // named after has to say so where it is defined.
    const source = readRepoFile("src/core/perclos.ts", repoRoot());
    expect(source).toContain("blink time");
  });

  it("the blink-count sentence says floor, not count, and cites the tables", () => {
    const sentence = blinkCountConditionsSentence();
    expect(sentence).toContain("floor, not a count");
    expect(sentence).toContain("docs/blink-sample-rate.txt");
    // The loss is real at ordinary webcam rates and the sentence must
    // say where it bites rather than gesture at "low fps".
    expect(sentence).toMatch(/25|30/);
  });
});

describe("the committed table, recomputed", () => {
  // The full sweep is 24 million sample checks: fast bare, roughly ten
  // times slower under coverage instrumentation, which is what CI's
  // coverage step runs. One shared computation and an explicit
  // timeout, or the gate that exists to catch drift times out instead.
  let sharedTable: ReturnType<typeof samplingBoundsTable> | null = null;
  const theTable = () => {
    sharedTable ??= samplingBoundsTable();
    return sharedTable;
  };

  it("docs/sampling-bounds.txt states what the sweep computes", () => {
    const doc = readRepoFile("docs/sampling-bounds.txt", repoRoot());
    expect(doc).toContain("THE BOUNDS, MEASURED");
    // The committed sweep parameters and the code's constants are one.
    expect(SAMPLING_WINDOW_S).toBe(60);
    expect(SAMPLING_BOUND_DRAWS).toBe(2000);
    expect(SAMPLING_BOUND_FPS).toEqual([15, 25, 30, 60]);
    expect(SAMPLING_BOUND_FRACTIONS).toEqual([0.05, 0.15, 0.3]);
    expect(doc).toContain(String(SAMPLING_BOUND_SEED));

    const table = theTable();
    expect(table).toHaveLength(12);
    for (const cell of table) {
      const line = `${String(cell.fps)} fps  P=${cell.fraction.toFixed(2)}  p95 ${cell.p95Error.toFixed(4)}`;
      expect(doc, line).toContain(line);
    }
  }, 60_000);

  it("more frames never makes the bound worse within a fraction", () => {
    const table = theTable();
    for (const fraction of SAMPLING_BOUND_FRACTIONS) {
      const cells = table.filter((cell) => cell.fraction === fraction);
      for (let i = 1; i < cells.length; i += 1) {
        expect((cells[i] as { p95Error: number }).p95Error).toBeLessThanOrEqual(
          (cells[i - 1] as { p95Error: number }).p95Error,
        );
      }
    }
  }, 60_000);
});
