import { describe, expect, it } from "vitest";

import { pushBounded } from "../../src/core/ringBuffer";

describe("pushBounded", () => {
  it("appends below capacity", () => {
    expect(pushBounded(["a", "b"], "c", 4)).toEqual(["a", "b", "c"]);
  });

  it("appends exactly to capacity", () => {
    expect(pushBounded(["a", "b", "c"], "d", 4)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops the oldest beyond capacity, order preserved", () => {
    expect(pushBounded(["a", "b", "c", "d"], "e", 4)).toEqual([
      "b",
      "c",
      "d",
      "e",
    ]);
  });
});
