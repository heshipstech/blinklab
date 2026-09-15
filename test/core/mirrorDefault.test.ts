import { describe, expect, it } from "vitest";

import { mirrorDefaultForFacingMode } from "../../src/core/mirrorDefault";

// Roadmap 13.1, the environment-camera piece of the session-survival kit
// (decisions/ADR-0007-session-survival.md). Mirror defaults ON, which is
// right for a front camera a person watches their own face in and wrong
// for a rear ("environment") camera that frames the world — mirroring
// that flips the scene and any text in it. The decision is a pure
// function of the track's facingMode so it is testable without a camera;
// the wiring in main.ts applies it once facingMode is read.

describe("the Mirror default per camera facing (roadmap 13.1)", () => {
  it("mirrors a front (user) camera — the face-in-a-mirror default", () => {
    expect(mirrorDefaultForFacingMode("user")).toBe(true);
  });

  it("does NOT mirror an environment (rear) camera — it frames the world", () => {
    expect(mirrorDefaultForFacingMode("environment")).toBe(false);
  });

  it("keeps the mirrored default when facingMode is unknown or absent", () => {
    // A laptop webcam commonly reports no facingMode, and it is a front
    // camera; the person can always toggle it. "left"/"right" are valid
    // facing values that are not the rear camera, so they mirror too.
    expect(mirrorDefaultForFacingMode(null)).toBe(true);
    expect(mirrorDefaultForFacingMode("")).toBe(true);
    expect(mirrorDefaultForFacingMode("left")).toBe(true);
    expect(mirrorDefaultForFacingMode("right")).toBe(true);
  });
});
