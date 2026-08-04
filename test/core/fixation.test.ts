import { describe, expect, it } from "vitest";

import {
  detectFixations,
  dispersionOffset,
  FIXATION_DISPERSION_THRESHOLD,
  MIN_FIXATION_DURATION_MS,
  type GazeSample,
} from "../../src/core/fixation";

const DT_MS = 1000 / 30;

// A tiny seeded generator, same idea as the 5.6 tests: repeatable
// noise, no wall clock, no randomness across runs.
function makeNoise(seedStart: number): () => number {
  let seed = seedStart;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
}

// Builds the ladder's synthetic scanpath: stretches of jittered
// stillness at known centres, joined by fast linear sweeps.
type Stage =
  | { kind: "fixate"; h: number; v: number; frames: number }
  | { kind: "sweep"; toH: number; toV: number; frames: number };

function scanpath(stages: readonly Stage[], jitter: number): GazeSample[] {
  const noise = makeNoise(7);
  const samples: GazeSample[] = [];
  let h = 0;
  let v = 0;
  let t = 0;
  for (const stage of stages) {
    if (stage.kind === "fixate") {
      for (let i = 0; i < stage.frames; i++) {
        samples.push({
          timestampMs: t,
          offset: {
            horizontal: stage.h + noise() * jitter,
            vertical: stage.v + noise() * jitter,
          },
        });
        h = stage.h;
        v = stage.v;
        t += DT_MS;
      }
    } else {
      for (let i = 1; i <= stage.frames; i++) {
        samples.push({
          timestampMs: t,
          offset: {
            horizontal: h + ((stage.toH - h) * i) / stage.frames,
            vertical: v + ((stage.toV - v) * i) / stage.frames,
          },
        });
        t += DT_MS;
      }
      h = stage.toH;
      v = stage.toV;
    }
  }
  return samples;
}

function at(h: number, v: number, timestampMs: number): GazeSample {
  return { timestampMs, offset: { horizontal: h, vertical: v } };
}

describe("dispersionOffset", () => {
  it("sums the horizontal and vertical ranges", () => {
    const samples = [at(0, 0, 0), at(0.03, -0.01, 33), at(0.01, 0.02, 66)];
    expect(dispersionOffset(samples)).toBeCloseTo(0.03 + 0.03, 12);
  });

  it("is zero for a single sample and null for none", () => {
    expect(dispersionOffset([at(0.1, 0.1, 0)])).toBe(0);
    expect(dispersionOffset([])).toBeNull();
  });
});

describe("detectFixations on the synthetic scanpath", () => {
  const A = { h: 0, v: 0 };
  const B = { h: 0.12, v: -0.06 };
  const C = { h: -0.1, v: 0.08 };

  it("finds exactly the three staged fixations, in order, sweeps in neither", () => {
    const samples = scanpath(
      [
        { kind: "fixate", ...A, frames: 10 },
        { kind: "sweep", toH: B.h, toV: B.v, frames: 3 },
        { kind: "fixate", ...B, frames: 13 },
        { kind: "sweep", toH: C.h, toV: C.v, frames: 3 },
        { kind: "fixate", ...C, frames: 8 },
      ],
      0.004,
    );
    const fixations = detectFixations(samples);
    expect(fixations.length).toBe(3);
    const centres = [A, B, C];
    fixations.forEach((fixation, i) => {
      const centre = centres[i];
      expect(centre).toBeDefined();
      if (centre !== undefined) {
        expect(fixation.centroid.horizontal).toBeCloseTo(centre.h, 2);
        expect(fixation.centroid.vertical).toBeCloseTo(centre.v, 2);
      }
    });
    // Fixations never overlap and never swallow a sweep: each starts
    // after the previous one ended.
    expect(fixations[0]?.endMs).toBeLessThan(fixations[1]?.startMs ?? -1);
    expect(fixations[1]?.endMs).toBeLessThan(fixations[2]?.startMs ?? -1);
    // Durations come out near the staged stretches, within a frame
    // or two of tolerance at the edges.
    const stagedMs = [10, 13, 8].map((frames) => (frames - 1) * DT_MS);
    fixations.forEach((fixation, i) => {
      expect(
        Math.abs(fixation.endMs - fixation.startMs - (stagedMs[i] ?? 0)),
      ).toBeLessThanOrEqual(2 * DT_MS);
    });
  });

  it("finds nothing in a pure sweep", () => {
    const samples = scanpath(
      [{ kind: "sweep", toH: 0.3, toV: 0.2, frames: 30 }],
      0,
    );
    expect(detectFixations(samples)).toEqual([]);
  });

  it("refuses a pause shorter than the minimum duration", () => {
    // 80 ms of perfect stillness, below the minimum: not a fixation.
    const frames = Math.floor(80 / DT_MS) + 1;
    const samples = scanpath([{ kind: "fixate", ...A, frames }], 0);
    expect(detectFixations(samples)).toEqual([]);
  });

  it("returns nothing for an empty input", () => {
    expect(detectFixations([])).toEqual([]);
  });
});

describe("detectFixations boundary trios", () => {
  it("runs the duration boundary: exactly the minimum counts", () => {
    const just = [at(0, 0, 0), at(0, 0, MIN_FIXATION_DURATION_MS)];
    const under = [at(0, 0, 0), at(0, 0, MIN_FIXATION_DURATION_MS - 1)];
    const over = [at(0, 0, 0), at(0, 0, MIN_FIXATION_DURATION_MS + 1)];
    expect(detectFixations(just).length).toBe(1);
    expect(detectFixations(under).length).toBe(0);
    expect(detectFixations(over).length).toBe(1);
  });

  it("runs the dispersion boundary: exactly the threshold still fixates", () => {
    const spread = FIXATION_DISPERSION_THRESHOLD / 2;
    const fits = [
      at(0, 0, 0),
      at(spread, spread, MIN_FIXATION_DURATION_MS / 2),
      at(0, 0, MIN_FIXATION_DURATION_MS),
    ];
    const exceeds = [
      at(0, 0, 0),
      at(spread + 0.001, spread, MIN_FIXATION_DURATION_MS / 2),
      at(0, 0, MIN_FIXATION_DURATION_MS),
    ];
    expect(detectFixations(fits).length).toBe(1);
    expect(detectFixations(exceeds).length).toBe(0);
  });

  it("reports the centroid as the plain mean of the window", () => {
    const samples = [
      at(0.01, 0.005, 0),
      at(0.015, 0, 60),
      at(0.02, 0.01, MIN_FIXATION_DURATION_MS),
    ];
    const fixations = detectFixations(samples);
    expect(fixations.length).toBe(1);
    expect(fixations[0]?.centroid.horizontal).toBeCloseTo(0.015, 12);
    expect(fixations[0]?.centroid.vertical).toBeCloseTo(0.005, 12);
  });
});
