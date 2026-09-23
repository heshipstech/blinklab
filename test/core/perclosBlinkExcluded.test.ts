import { describe, expect, it } from "vitest";

import {
  emptyPerclos,
  perclosStep,
  perclosValue,
  type PerclosState,
} from "../../src/core/perclos";
import { blinkExcludedPerclosValue } from "../../src/core/perclosBlinkExcluded";

// Roadmap 12.10a. The literature's PERCLOS counts slow closures and
// leaves blinks out; this instrument's perclos cannot, because its shut
// line is the one every full blink crosses. The blink-excluded share
// reads the SAME sample buffer with closures at or below the blink
// maximum left out, so the two columns can never be fed different
// frames. The score keeps the current perclos until 12.18 reads.

const BASELINE_MM = 10;
const OPEN_MM = 8;
const CLOSED_MM = 1;
const DT_MS = 1000 / 30;

/** One frame per entry at 30 fps: open, closed, or untrusted. */
function runFrames(frames: readonly ("o" | "c" | "g")[]): {
  state: PerclosState;
  nowMs: number;
} {
  let state = emptyPerclos();
  let t = 0;
  for (const frame of frames) {
    const aperture = frame === "g" ? null : frame === "c" ? CLOSED_MM : OPEN_MM;
    state = perclosStep(state, t, aperture, BASELINE_MM);
    t += DT_MS;
  }
  return { state, nowMs: t - DT_MS };
}

/** Explicit timestamps, for boundaries a 30 fps grid cannot land on. */
function runPoints(points: readonly (readonly [number, number | null])[]): {
  state: PerclosState;
  nowMs: number;
} {
  let state = emptyPerclos();
  let last = 0;
  for (const [t, aperture] of points) {
    state = perclosStep(state, t, aperture, BASELINE_MM);
    last = t;
  }
  return { state, nowMs: last };
}

const open = (n: number): "o"[] => Array<"o">(n).fill("o");
const shut = (n: number): "c"[] => Array<"c">(n).fill("c");
const gap = (n: number): "g"[] => Array<"g">(n).fill("g");

// A 200 ms blink (six frames at 30 fps) every four seconds, for a
// minute: fifteen ordinary blinks and nothing else.
function blinkingMinute(): ("o" | "c" | "g")[] {
  const frames: ("o" | "c" | "g")[] = [];
  for (let i = 0; i < 15; i += 1) {
    frames.push(...open(114), ...shut(6));
  }
  return frames;
}

describe("the blink-excluded share", () => {
  it("reads zero for a minute of ordinary blinks that perclos counts", () => {
    // The whole reason for the second column: at rest perclos IS mostly
    // blink time, and the literature's measure would read nothing here.
    const { state, nowMs } = runFrames(blinkingMinute());
    expect(perclosValue(state, nowMs)).toBeGreaterThan(0);
    expect(blinkExcludedPerclosValue(state, nowMs)).toBe(0);
  });

  it("counts a slow closure in full, agreeing with perclos", () => {
    // 54 seconds open then 6 seconds shut, perclos.test.ts's own
    // script: one closure, far past the blink maximum, so both read 0.1.
    const { state, nowMs } = runFrames([...open(54 * 30), ...shut(6 * 30)]);
    expect(perclosValue(state, nowMs)).toBeCloseTo(0.1, 12);
    expect(blinkExcludedPerclosValue(state, nowMs)).toBeCloseTo(0.1, 12);
  });

  it("keeps only the slow closure when blinks surround it", () => {
    // Blinks every four seconds plus one 3-second closure: the slow
    // closure's 90 frames count, the blinks' frames do not. The open
    // second before it keeps the last blink from running into it.
    const frames = [
      ...blinkingMinute().slice(0, 1200),
      ...open(30),
      ...shut(90),
      ...open(480),
    ];
    const { state, nowMs } = runFrames(frames);
    const total = state.samples.filter(
      (s) => nowMs - s.timestampMs <= 60_000,
    ).length;
    expect(blinkExcludedPerclosValue(state, nowMs)).toBeCloseTo(90 / total, 12);
  });

  it("never exceeds perclos, and refuses exactly when perclos refuses", () => {
    const scripts: ("o" | "c" | "g")[][] = [
      blinkingMinute(),
      [...open(54 * 30), ...shut(6 * 30)],
      [...open(300), ...shut(10), ...gap(40), ...shut(10), ...open(300)],
      [...open(90)],
      [...shut(1800)],
    ];
    for (const script of scripts) {
      const { state, nowMs } = runFrames(script);
      const all = perclosValue(state, nowMs);
      const slow = blinkExcludedPerclosValue(state, nowMs);
      expect(slow === null).toBe(all === null);
      if (all !== null && slow !== null) {
        expect(slow).toBeLessThanOrEqual(all);
      }
    }
  });
});

describe("the blink maximum is the edge, at the line a closure is a blink", () => {
  // 20 seconds of open samples every 20 ms clear the 100-sample and
  // 15-second floors; one closure sits in the middle, measured from its
  // first closed sample to its reopen, the span blink.ts measures.
  function withClosure(reopenAfterMs: number): {
    state: PerclosState;
    nowMs: number;
  } {
    const points: [number, number | null][] = [];
    for (let t = 0; t < 10_000; t += 20) points.push([t, OPEN_MM]);
    for (let t = 10_000; t < 10_000 + 500; t += 20) {
      points.push([t, CLOSED_MM]);
    }
    const reopen = 10_000 + reopenAfterMs;
    for (let t = reopen; t <= 20_000; t += 20) points.push([t, OPEN_MM]);
    return runPoints(points);
  }

  it("leaves a closure of exactly 500 ms out, as blink.ts counts it", () => {
    // Literal probes (roadmap 10.1c): 500 and 501, never derived from
    // the constant, so moving the blink maximum reddens this.
    const { state, nowMs } = withClosure(500);
    expect(blinkExcludedPerclosValue(state, nowMs)).toBe(0);
  });

  it("counts a closure of 501 ms, strictly past the blink maximum", () => {
    const { state, nowMs } = withClosure(501);
    const slow = blinkExcludedPerclosValue(state, nowMs);
    expect(slow).not.toBeNull();
    expect(slow as number).toBeGreaterThan(0);
  });
});

describe("an untrusted gap splits a closure only past the gap bound", () => {
  it("joins two short closed spans across a brief untrusted run", () => {
    // 300 ms shut, 100 ms untrusted, 300 ms shut: eyes shut either side
    // of a sub-blink gap did not plausibly open, longClosure.ts's rule,
    // so this is one 700 ms closure and it counts.
    const { state, nowMs } = runFrames([
      ...open(600),
      ...shut(9),
      ...gap(3),
      ...shut(9),
      ...open(300),
    ]);
    expect(blinkExcludedPerclosValue(state, nowMs) as number).toBeGreaterThan(
      0,
    );
  });

  it("splits them across a gap longer than a blink, each too short to count", () => {
    // The same two 300 ms spans across a 600 ms untrusted run: the
    // closure's continuity is unwitnessed, so each span is judged on
    // its own and each is blink-sized.
    const { state, nowMs } = runFrames([
      ...open(600),
      ...shut(9),
      ...gap(18),
      ...shut(9),
      ...open(300),
    ]);
    expect(perclosValue(state, nowMs) as number).toBeGreaterThan(0);
    expect(blinkExcludedPerclosValue(state, nowMs)).toBe(0);
  });
});
