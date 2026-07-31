import { describe, expect, it } from "vitest";

import {
  inferenceMessage,
  meanDurationMs,
  pushSample,
} from "../../src/core/timing";

describe("pushSample", () => {
  it("appends below the cap", () => {
    expect(pushSample([1, 2], 3, 4)).toEqual([1, 2, 3]);
  });

  it("appends exactly to the cap", () => {
    expect(pushSample([1, 2, 3], 4, 4)).toEqual([1, 2, 3, 4]);
  });

  it("drops the oldest above the cap, keeping the most recent", () => {
    expect(pushSample([1, 2, 3, 4], 5, 4)).toEqual([2, 3, 4, 5]);
  });
});

describe("meanDurationMs", () => {
  it("averages hand checkable values", () => {
    expect(meanDurationMs([10, 20, 30])).toBe(20);
  });

  it("returns null for no samples instead of guessing", () => {
    expect(meanDurationMs([])).toBeNull();
  });
});

describe("inferenceMessage", () => {
  it("reports measuring while there is no mean yet", () => {
    expect(inferenceMessage(null)).toContain("measuring");
  });

  it("names the number and the budget when under it", () => {
    const message = inferenceMessage(12.4);
    expect(message).toContain("12");
    expect(message).toContain("30");
    expect(message).not.toContain("over");
  });

  it("stays calm exactly at the budget", () => {
    expect(inferenceMessage(30)).not.toContain("over");
  });

  it("says over the budget just above it", () => {
    expect(inferenceMessage(30.1)).toContain("over");
  });
});
