import { describe, expect, it } from "vitest";

import {
  LANDMARK_COUNT,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
} from "../../src/core/constants";

describe("eye landmark index sets", () => {
  it("do not overlap, no index belongs to both eyes", () => {
    const left = new Set(LEFT_EYE_INDICES);
    for (const index of RIGHT_EYE_INDICES) {
      expect(left.has(index)).toBe(false);
    }
  });

  it("stay within the model's landmark range", () => {
    for (const index of [...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES]) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(LANDMARK_COUNT);
    }
  });

  it("contain no duplicates within either eye", () => {
    expect(new Set(LEFT_EYE_INDICES).size).toBe(LEFT_EYE_INDICES.length);
    expect(new Set(RIGHT_EYE_INDICES).size).toBe(RIGHT_EYE_INDICES.length);
  });

  it("describe both eyes with the same number of points", () => {
    expect(LEFT_EYE_INDICES.length).toBe(RIGHT_EYE_INDICES.length);
    expect(LEFT_EYE_INDICES.length).toBeGreaterThan(0);
  });
});
