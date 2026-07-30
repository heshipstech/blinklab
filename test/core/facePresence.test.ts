import { describe, expect, it } from "vitest";

import { isFacePresent } from "../../src/core/facePresence";

function faceWithLandmarks(): { x: number; y: number; z: number }[] {
  return [
    { x: 0.5, y: 0.5, z: 0 },
    { x: 0.6, y: 0.4, z: 0 },
  ];
}

describe("isFacePresent", () => {
  it("is false when the model reports no faces at all", () => {
    expect(isFacePresent({ faceLandmarks: [] })).toBe(false);
  });

  it("is false when a face entry exists but carries zero landmarks", () => {
    expect(isFacePresent({ faceLandmarks: [[]] })).toBe(false);
  });

  it("is true when one face with landmarks is reported", () => {
    expect(isFacePresent({ faceLandmarks: [faceWithLandmarks()] })).toBe(true);
  });

  it("is true when several faces are reported", () => {
    expect(
      isFacePresent({
        faceLandmarks: [faceWithLandmarks(), faceWithLandmarks()],
      }),
    ).toBe(true);
  });
});
