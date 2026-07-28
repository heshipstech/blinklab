import { describe, expect, it } from "vitest";

import { displaySize } from "../../src/core/videoLayout";

// Regression tests for issue #22: the camera preview rendered squeezed
// because the element size ignored the stream's real proportions.
describe("displaySize", () => {
  it("preserves 16 to 9 proportions at the target width", () => {
    expect(displaySize(1280, 720, 640)).toEqual({ width: 640, height: 360 });
  });

  it("preserves 4 to 3 proportions instead of forcing widescreen", () => {
    expect(displaySize(640, 480, 640)).toEqual({ width: 640, height: 480 });
  });

  it("rounds to whole pixels", () => {
    expect(displaySize(1000, 333, 640)).toEqual({ width: 640, height: 213 });
  });

  it("returns null for a zero or negative stream size", () => {
    expect(displaySize(0, 720, 640)).toBeNull();
    expect(displaySize(1280, 0, 640)).toBeNull();
    expect(displaySize(-1280, 720, 640)).toBeNull();
  });

  it("returns null for a zero target width", () => {
    expect(displaySize(1280, 720, 0)).toBeNull();
  });
});
