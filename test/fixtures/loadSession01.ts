import type { LandmarkPoint } from "../../src/core/facePresence";

import raw from "./session-01.json";

// The fixture harness: every test that wants five seconds of a real
// face goes through here, and nowhere else touches the JSON shape.
export type SessionFixture = {
  landmarkCountPerFrame: number;
  frameCount: number;
  frames: {
    timestampMs: number;
    landmarks: number[][];
  }[];
};

export function loadSession01(): SessionFixture {
  return raw as SessionFixture;
}

// Converts one frame's compact triples back into named points.
export function frameLandmarks(
  frame: SessionFixture["frames"][number],
): LandmarkPoint[] {
  return frame.landmarks.map((triple) => ({
    x: triple[0] ?? 0,
    y: triple[1] ?? 0,
    z: triple[2] ?? 0,
  }));
}
