import { describe, expect, it } from "vitest";

import { distance } from "../../src/core/geometry";

describe("distance", () => {
  it("is zero from a point to itself", () => {
    expect(distance({ x: 2, y: 7 }, { x: 2, y: 7 })).toBe(0);
  });

  it("solves the 3 4 5 triangle", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is the same in both directions", () => {
    const a = { x: -1.5, y: 0.25 };
    const b = { x: 4, y: -3 };
    expect(distance(a, b)).toBe(distance(b, a));
  });
});
