import { describe, expect, it } from "vitest";

import {
  addFrame,
  isComplete,
  serializeFixture,
  startRecording,
  type FixtureFrame,
} from "../../src/core/fixtureRecording";

function frameAt(timestampMs: number): FixtureFrame {
  return {
    timestampMs,
    landmarks: [{ x: 0.123456789, y: 0.5, z: -0.0123456 }],
  };
}

describe("recording state", () => {
  it("starts empty and incomplete", () => {
    const state = startRecording(3);
    expect(state.frames).toEqual([]);
    expect(isComplete(state)).toBe(false);
  });

  it("appends frames up to the target", () => {
    let state = startRecording(3);
    state = addFrame(state, frameAt(1));
    state = addFrame(state, frameAt(2));
    expect(state.frames.length).toBe(2);
    expect(isComplete(state)).toBe(false);
  });

  it("is complete exactly at the target", () => {
    let state = startRecording(2);
    state = addFrame(state, frameAt(1));
    state = addFrame(state, frameAt(2));
    expect(isComplete(state)).toBe(true);
  });

  it("refuses frames beyond the target instead of growing", () => {
    let state = startRecording(2);
    state = addFrame(state, frameAt(1));
    state = addFrame(state, frameAt(2));
    state = addFrame(state, frameAt(3));
    expect(state.frames.length).toBe(2);
  });
});

describe("serializeFixture", () => {
  it("rounds coordinates to four decimals and stores triples", () => {
    let state = startRecording(1);
    state = addFrame(state, frameAt(16.6666));
    const parsed = JSON.parse(serializeFixture(state)) as {
      landmarkCountPerFrame: number;
      frameCount: number;
      frames: { timestampMs: number; landmarks: number[][] }[];
    };
    expect(parsed.frameCount).toBe(1);
    expect(parsed.landmarkCountPerFrame).toBe(1);
    expect(parsed.frames[0]?.timestampMs).toBe(16.6666);
    expect(parsed.frames[0]?.landmarks[0]).toEqual([0.1235, 0.5, -0.0123]);
  });
});
