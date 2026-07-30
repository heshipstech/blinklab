import { describe, expect, it } from "vitest";

import {
  LANDMARK_COUNT,
  LEFT_EYE_INDICES,
  LEFT_IRIS_CENTER_INDEX,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
  RIGHT_IRIS_RING_INDICES,
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

describe("iris landmark index sets", () => {
  it("each ring holds four distinct indices inside the model's range", () => {
    for (const ring of [RIGHT_IRIS_RING_INDICES, LEFT_IRIS_RING_INDICES]) {
      expect(ring.length).toBe(4);
      expect(new Set(ring).size).toBe(4);
      for (const index of ring) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(LANDMARK_COUNT);
      }
    }
  });

  it("forms a closed ring: the four indices directly after their centre", () => {
    expect(RIGHT_IRIS_RING_INDICES).toEqual(
      [1, 2, 3, 4].map((offset) => RIGHT_IRIS_CENTER_INDEX + offset),
    );
    expect(LEFT_IRIS_RING_INDICES).toEqual(
      [1, 2, 3, 4].map((offset) => LEFT_IRIS_CENTER_INDEX + offset),
    );
  });

  it("shares nothing with the eyelid sets or the other iris", () => {
    const eyelids = new Set([...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES]);
    const right = [RIGHT_IRIS_CENTER_INDEX, ...RIGHT_IRIS_RING_INDICES];
    const left = [LEFT_IRIS_CENTER_INDEX, ...LEFT_IRIS_RING_INDICES];
    for (const index of [...right, ...left]) {
      expect(eyelids.has(index)).toBe(false);
    }
    const rightSet = new Set(right);
    for (const index of left) {
      expect(rightSet.has(index)).toBe(false);
    }
  });
});
