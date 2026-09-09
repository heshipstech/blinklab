import { describe, expect, it } from "vitest";

import {
  blinkStep,
  initialBlinkState,
  type BlinkState,
} from "../../src/core/blink";
import {
  blinkRatePerMin,
  countingSuspended,
  gatedBlinkRatePerMin,
  observedFraction,
  observeFrame,
  recordBlink,
  startRate,
  suspendedSentence,
  suspendedSinceMs,
  type BlinkRateState,
} from "../../src/core/blinkRate";
import {
  BLINK_RATE_MIN_OBSERVATION_MS,
  BLINK_RATE_WINDOW_MS,
  MAX_BLINK_DURATION_MS,
} from "../../src/core/constants";

// Roadmap 10.12b. The rate used to divide by the wall clock, so a
// face-loss gap diluted the numerator and read as calm — the row's
// first Check clause. The denominator is now the time the detector
// was actually FED an aperture, windowed like the blink times, and
// the tests below build their observation explicitly instead of
// assuming the wall clock observed anything.

const STEP_MS = 40;

function fedEvery(
  state: BlinkRateState,
  fromMs: number,
  toMs: number,
): BlinkRateState {
  let out = state;
  for (let t = fromMs; t <= toMs; t += STEP_MS) {
    out = observeFrame(out, t, true);
  }
  return out;
}

function withBlinksAt(observedToMs: number, timesMs: number[]): BlinkRateState {
  let state = fedEvery(startRate(0), 0, observedToMs);
  for (const t of timesMs) {
    state = recordBlink(state, t);
  }
  return state;
}

describe("blinkRatePerMin over observed time", () => {
  it("reads ten blinks over a fully observed window as ten per minute", () => {
    const times = Array.from({ length: 10 }, (_, i) => i * 6000);
    expect(blinkRatePerMin(withBlinksAt(60000, times), 60000)).toBeCloseTo(
      10,
      6,
    );
  });

  it("scales honestly while the observation is still young", () => {
    const state = withBlinksAt(20000, [2000, 8000, 14000, 16000, 19000]);
    expect(blinkRatePerMin(state, 20000)).toBeCloseTo(15, 6);
  });

  it("a face-loss gap no longer reads as calm", () => {
    // The row's first Check clause, verbatim. Twenty seconds observed
    // with four blinks, then the face is lost for forty: the wall
    // clock says four per minute, calm; the observed time says
    // twelve, which is what those twenty seconds actually showed.
    const state = withBlinksAt(20000, [3000, 8000, 13000, 18000]);
    expect(blinkRatePerMin(state, 60000)).toBeCloseTo(12, 6);
    expect(observedFraction(state, 60000)).toBeCloseTo(20000 / 60000, 6);
  });

  it("runs the boundary trio on the observation minimum", () => {
    // The minimum is now a minimum of OBSERVED time: a gap in the
    // feed postpones the first rate rather than aging it in.
    const just = BLINK_RATE_MIN_OBSERVATION_MS;
    const below = fedEvery(startRate(0), 0, just - STEP_MS);
    const at = fedEvery(startRate(0), 0, just);
    const above = fedEvery(startRate(0), 0, just + STEP_MS);
    expect(blinkRatePerMin(recordBlink(below, 5000), just)).toBeNull();
    expect(blinkRatePerMin(recordBlink(at, 5000), just)).not.toBeNull();
    expect(
      blinkRatePerMin(recordBlink(above, 5000), just + STEP_MS),
    ).not.toBeNull();
  });

  it("runs the boundary trio on the blink window edge", () => {
    const nowMs = 200000;
    const atEdge = nowMs - BLINK_RATE_WINDOW_MS;
    const observed = fedEvery(startRate(0), atEdge, nowMs);
    const kept = blinkRatePerMin(recordBlink(observed, atEdge), nowMs);
    const justInside = blinkRatePerMin(
      recordBlink(observed, atEdge + 1),
      nowMs,
    );
    const justOutside = blinkRatePerMin(
      recordBlink(observed, atEdge - 1),
      nowMs,
    );
    expect(kept).toBeCloseTo(1, 6);
    expect(justInside).toBeCloseTo(1, 6);
    expect(justOutside).toBeCloseTo(0, 6);
  });

  it("forgets blinks and observation that age out of the window", () => {
    const times = Array.from({ length: 10 }, (_, i) => i * 1000);
    let state = withBlinksAt(10000, times);
    // The feed continues to 120000, the blinks do not.
    state = fedEvery(state, 10000 + STEP_MS, 120000);
    expect(blinkRatePerMin(state, 120000)).toBeCloseTo(0, 6);
  });

  it("reads an empty but observed window as zero, not null", () => {
    expect(
      blinkRatePerMin(fedEvery(startRate(0), 0, 60000), 60000),
    ).toBeCloseTo(0, 6);
  });

  it("reads NO rate at all from an unobserved window", () => {
    // Sixty seconds of wall time with nothing fed is not sixty
    // seconds of observation. This is the whole correction.
    expect(blinkRatePerMin(startRate(0), 60000)).toBeNull();
  });

  it("ignores a backwards clock on the frame feed", () => {
    const state = fedEvery(startRate(0), 0, 1000);
    expect(observeFrame(state, 500, true)).toBe(state);
  });

  it("ignores an unfed frame without recording it", () => {
    const state = fedEvery(startRate(0), 0, 1000);
    expect(observeFrame(state, 2000, false)).toBe(state);
  });
});

describe("observedFraction", () => {
  it("is null before any wall time has passed", () => {
    expect(observedFraction(startRate(0), 0)).toBeNull();
  });

  it("reads a continuous feed as one, clamped", () => {
    const state = fedEvery(startRate(0), 0, 60000);
    expect(observedFraction(state, 60000)).toBeCloseTo(1, 6);
  });
});

describe("counting-suspended as a fact", () => {
  function stepped(apertures: [number, number | null][]): BlinkState {
    let blink = initialBlinkState;
    for (const [t, mm] of apertures) {
      blink = blinkStep(blink, t, mm, 4);
    }
    return blink;
  }

  it("resting at 4.2 mm on a 4.0 line with five deep blinks reads suspended, not 1", () => {
    // The row's second Check clause, verbatim. The re-arm gate wants
    // the eye clearly above the line (4.4 mm on a 4.0 line); an eye
    // resting at 4.2 counts one blink and then silently drops the
    // other four. The record must say SUSPENDED rather than publish
    // a rate of one.
    const frames: [number, number | null][] = [];
    let t = 0;
    for (let blinkIndex = 0; blinkIndex < 5; blinkIndex += 1) {
      frames.push([t, 4.2], [t + 100, 2.0], [t + 200, 2.0], [t + 300, 4.2]);
      t += 1000;
    }
    const blink = stepped(frames);
    expect(blink.blinkCount).toBe(1);
    expect(countingSuspended(blink, t)).toBe(true);
    let rate = startRate(0);
    for (let f = 0; f <= t; f += STEP_MS) {
      rate = observeFrame(rate, f, true);
    }
    rate = recordBlink(rate, 300);
    expect(gatedBlinkRatePerMin(30, rate, blink, t)).toBeNull();
  });

  it("reads a closure past the blink maximum as suspended", () => {
    const blink = stepped([
      [0, 5],
      [100, 2],
    ]);
    const stillClosedAt = 100 + MAX_BLINK_DURATION_MS + 1;
    expect(countingSuspended(blink, stillClosedAt)).toBe(true);
    expect(suspendedSinceMs(blink, stillClosedAt)).toBe(100);
  });

  it("does not read an ordinary measuring state as suspended", () => {
    const blink = stepped([
      [0, 5],
      [100, 2],
      [250, 5],
    ]);
    expect(countingSuspended(blink, 300)).toBe(false);
    expect(suspendedSinceMs(blink, 300)).toBeNull();
  });

  it("dates the suspension from the blink that shut the gate", () => {
    const blink = stepped([
      [0, 4.2],
      [100, 2.0],
      [250, 4.2],
    ]);
    expect(blink.blinkCount).toBe(1);
    expect(countingSuspended(blink, 300)).toBe(true);
    expect(suspendedSinceMs(blink, 300)).toBe(250);
  });

  it("speaks the suspension in the row's own words", () => {
    expect(suspendedSentence(7)).toBe("Blink counting suspended for 7 s");
  });
});
