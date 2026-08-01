import { describe, expect, it } from "vitest";

import {
  blinkRatePerMin,
  recordBlink,
  startRate,
  type BlinkRateState,
} from "../../src/core/blinkRate";
import {
  BLINK_RATE_MIN_OBSERVATION_MS,
  BLINK_RATE_WINDOW_MS,
} from "../../src/core/constants";

function withBlinksAt(startMs: number, timesMs: number[]): BlinkRateState {
  let state = startRate(startMs);
  for (const t of timesMs) {
    state = recordBlink(state, t);
  }
  return state;
}

describe("blinkRatePerMin", () => {
  it("reads ten blinks over a full window as ten per minute", () => {
    const times = Array.from({ length: 10 }, (_, i) => i * 6000);
    expect(blinkRatePerMin(withBlinksAt(0, times), 60000)).toBeCloseTo(10, 6);
  });

  it("scales honestly while the window is still young", () => {
    const state = withBlinksAt(0, [2000, 8000, 14000, 16000, 19000]);
    expect(blinkRatePerMin(state, 20000)).toBeCloseTo(15, 6);
  });

  it("runs the boundary trio on the observation minimum", () => {
    const state = withBlinksAt(0, [5000]);
    expect(
      blinkRatePerMin(state, BLINK_RATE_MIN_OBSERVATION_MS - 1),
    ).toBeNull();
    expect(
      blinkRatePerMin(state, BLINK_RATE_MIN_OBSERVATION_MS),
    ).not.toBeNull();
    expect(
      blinkRatePerMin(state, BLINK_RATE_MIN_OBSERVATION_MS + 1),
    ).not.toBeNull();
  });

  it("runs the boundary trio on the window edge", () => {
    const nowMs = 200000;
    const atEdge = nowMs - BLINK_RATE_WINDOW_MS;
    const kept = blinkRatePerMin(withBlinksAt(0, [atEdge]), nowMs);
    const justInside = blinkRatePerMin(withBlinksAt(0, [atEdge + 1]), nowMs);
    const justOutside = blinkRatePerMin(withBlinksAt(0, [atEdge - 1]), nowMs);
    expect(kept).toBeCloseTo(1, 6);
    expect(justInside).toBeCloseTo(1, 6);
    expect(justOutside).toBeCloseTo(0, 6);
  });

  it("forgets blinks that age out of the window", () => {
    const times = Array.from({ length: 10 }, (_, i) => i * 1000);
    const state = withBlinksAt(0, times);
    expect(blinkRatePerMin(state, 120000)).toBeCloseTo(0, 6);
  });

  it("reads an empty but mature window as zero, not null", () => {
    expect(blinkRatePerMin(startRate(0), 60000)).toBeCloseTo(0, 6);
  });
});
