import { describe, expect, it } from "vitest";

import { pickPoints } from "../../src/core/landmarks";

const items = ["a", "b", "c", "d"];

describe("pickPoints", () => {
  it("picks items by index, in the order the indices ask", () => {
    expect(pickPoints(items, [2, 0])).toEqual(["c", "a"]);
  });

  it("skips indices that do not exist instead of inventing entries", () => {
    expect(pickPoints(items, [1, 99])).toEqual(["b"]);
  });

  it("returns an empty list for an empty index set", () => {
    expect(pickPoints(items, [])).toEqual([]);
  });
});
