import { describe, expect, it } from "vitest";

import { replayIndex, sliderTime } from "../../src/core/replay";

describe("replayIndex, the lookup behind the slider", () => {
  const timestamps = [100, 200, 300, 400, 500];

  it("returns zero for an empty recording", () => {
    expect(replayIndex([], 250)).toBe(0);
  });

  it("returns zero before the first sample", () => {
    expect(replayIndex(timestamps, 99)).toBe(0);
  });

  it("runs the boundary trio at a sample: exactly at still counts", () => {
    expect(replayIndex(timestamps, 299)).toBe(2);
    expect(replayIndex(timestamps, 300)).toBe(3);
    expect(replayIndex(timestamps, 301)).toBe(3);
  });

  it("returns everything at and beyond the last sample", () => {
    expect(replayIndex(timestamps, 500)).toBe(5);
    expect(replayIndex(timestamps, 9999)).toBe(5);
  });

  it("agrees with a plain linear count on a longer recording", () => {
    // The binary search must match the obvious slow answer at every
    // probe, including between samples and outside the range.
    const many = Array.from({ length: 137 }, (_, i) => i * 33);
    for (const atMs of [-1, 0, 16, 33, 34, 1000, 137 * 33, 999999]) {
      const slow = many.filter((t) => t <= atMs).length;
      expect(replayIndex(many, atMs)).toBe(slow);
    }
  });
});

describe("sliderTime, fraction to moment", () => {
  it("maps the ends and the middle linearly", () => {
    expect(sliderTime(1000, 3000, 0)).toBe(1000);
    expect(sliderTime(1000, 3000, 0.5)).toBe(2000);
    expect(sliderTime(1000, 3000, 1)).toBe(3000);
  });

  it("clamps fractions outside the slider's travel", () => {
    expect(sliderTime(1000, 3000, -0.2)).toBe(1000);
    expect(sliderTime(1000, 3000, 1.7)).toBe(3000);
  });

  it("survives a session with a single moment", () => {
    expect(sliderTime(500, 500, 0.5)).toBe(500);
  });
});
