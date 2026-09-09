import { describe, expect, it } from "vitest";

import { MIN_BLINK_FPS } from "../../src/core/constants";
import {
  FACE_TIME_FRAME_CREDIT_MS,
  initialFaceTime,
  tickFaceTime,
  type FaceTimeState,
} from "../../src/core/faceSeconds";

// Roadmap 10.12c. One credit rule for "how long was a trusted face
// actually seen": each fed frame credits the gap to the previous fed
// frame, capped at one frame interval at the slowest measurable
// rate. The floors in baseline.ts and guidedCalibration.ts and the
// exported faceSeconds column all read this module, so the three
// cannot drift apart.

function fed(state: FaceTimeState, times: number[]): FaceTimeState {
  let out = state;
  for (const t of times) {
    out = tickFaceTime(out, t, true);
  }
  return out;
}

describe("the face-time credit", () => {
  it("derives its cap from the slowest measurable rate", () => {
    expect(FACE_TIME_FRAME_CREDIT_MS).toBe(1000 / MIN_BLINK_FPS);
  });

  it("credits real gaps at an ordinary rate in full", () => {
    // 30 fps: 33 ms gaps, all under the cap, so face time is elapsed
    // time — which is why the stepped corpus is byte-identical.
    const times = Array.from({ length: 91 }, (_, i) => i * 33);
    expect(fed(initialFaceTime, times).faceMs).toBe(90 * 33);
  });

  it("caps what duplicate-fed ticks can claim", () => {
    // The 120 Hz shape from docs/face-seconds.txt: 100 ticks at
    // 8.33 ms span 0.83 s of face, and that is all they credit —
    // duplicates of a photograph are not more evidence than the
    // photograph.
    const times = Array.from({ length: 100 }, (_, i) => Math.round(i * 8.33));
    const state = fed(initialFaceTime, times);
    expect(state.faceMs).toBeLessThan(1000);
  });

  it("credits a gap wider than the cap at the cap only", () => {
    // A fed frame after a two-second face loss vouches for one frame
    // interval, not for the loss.
    const state = fed(initialFaceTime, [0, 40, 2040]);
    expect(state.faceMs).toBe(40 + FACE_TIME_FRAME_CREDIT_MS);
  });

  it("ignores an unfed frame without recording it", () => {
    const state = fed(initialFaceTime, [0, 40]);
    expect(tickFaceTime(state, 80, false)).toBe(state);
  });

  it("ignores a backwards clock", () => {
    const state = fed(initialFaceTime, [0, 40]);
    expect(tickFaceTime(state, 20, true)).toBe(state);
  });
});
