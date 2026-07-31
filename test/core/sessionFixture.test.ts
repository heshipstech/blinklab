import { describe, expect, it } from "vitest";

import { LANDMARK_COUNT } from "../../src/core/constants";
import { isFacePresent } from "../../src/core/facePresence";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

const session = loadSession01();

// These tests sweep 300 frames x 478 landmarks. They count violations
// in plain code and assert zero, instead of making a million expect
// calls, so the suite stays fast.
describe("session-01 fixture", () => {
  it("holds exactly 300 frames, and says so consistently", () => {
    expect(session.frameCount).toBe(300);
    expect(session.frames.length).toBe(300);
  });

  it("carries the full landmark count in every single frame", () => {
    expect(session.landmarkCountPerFrame).toBe(LANDMARK_COUNT);
    const shortFrames = session.frames.filter(
      (frame) => frame.landmarks.length !== LANDMARK_COUNT,
    ).length;
    expect(shortFrames).toBe(0);
  });

  it("has strictly increasing timestamps spanning a real duration", () => {
    let nonIncreasing = 0;
    for (let i = 1; i < session.frames.length; i++) {
      const previous = session.frames[i - 1];
      const current = session.frames[i];
      if (
        previous === undefined ||
        current === undefined ||
        current.timestampMs <= previous.timestampMs
      ) {
        nonIncreasing += 1;
      }
    }
    expect(nonIncreasing).toBe(0);
    const first = session.frames[0];
    const last = session.frames[session.frames.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first !== undefined && last !== undefined) {
      expect(last.timestampMs - first.timestampMs).toBeGreaterThan(1000);
    }
  });

  it("keeps every coordinate in a sane normalised range", () => {
    let outOfRange = 0;
    for (const frame of session.frames) {
      for (const triple of frame.landmarks) {
        const [x, y, z] = triple;
        if (
          x === undefined ||
          y === undefined ||
          z === undefined ||
          x <= -0.5 ||
          x >= 1.5 ||
          y <= -0.5 ||
          y >= 1.5 ||
          z <= -1 ||
          z >= 1
        ) {
          outOfRange += 1;
        }
      }
    }
    expect(outOfRange).toBe(0);
  });

  it("reads as a present face to the real predicate, every frame", () => {
    const absentFrames = session.frames.filter(
      (frame) => !isFacePresent({ faceLandmarks: [frameLandmarks(frame)] }),
    ).length;
    expect(absentFrames).toBe(0);
  });
});
