import { describe, expect, it } from "vitest";

import { keepRecent, measureFps } from "../../src/core/fps";

describe("measureFps", () => {
  it("reads 10 fps from eleven frames spaced 100 ms apart", () => {
    const timestamps = Array.from({ length: 11 }, (_, i) => i * 100);
    expect(measureFps(timestamps)).toBe(10);
  });

  it("reads 50 fps from frames spaced 20 ms apart", () => {
    const timestamps = [0, 20, 40, 60, 80, 100];
    expect(measureFps(timestamps)).toBe(50);
  });

  it("returns a number from exactly two frames", () => {
    expect(measureFps([0, 40])).toBe(25);
  });

  it("returns null below two frames instead of guessing", () => {
    expect(measureFps([])).toBeNull();
    expect(measureFps([500])).toBeNull();
  });

  it("returns null when time did not move forward", () => {
    expect(measureFps([100, 100])).toBeNull();
    expect(measureFps([200, 100])).toBeNull();
  });
});

describe("keepRecent", () => {
  it("keeps a timestamp just inside the window", () => {
    expect(keepRecent([1001], 3000, 2000)).toEqual([1001]);
  });

  it("keeps a timestamp exactly at the window edge", () => {
    expect(keepRecent([1000], 3000, 2000)).toEqual([1000]);
  });

  it("drops a timestamp just outside the window", () => {
    expect(keepRecent([999], 3000, 2000)).toEqual([]);
  });

  it("keeps order while dropping only the old", () => {
    expect(keepRecent([500, 1500, 2500], 3000, 2000)).toEqual([1500, 2500]);
  });
});
