import { MIN_BLINK_FPS } from "./constants";

// How long a trusted face has actually been seen. Roadmap 10.12c.
//
// The processing loop runs at the display's pace, not the camera's,
// and past the camera's rate it re-reads the same photograph — so a
// count of fed ticks says nothing about how much face was witnessed.
// This module counts TIME instead: each fed frame credits the gap to
// the previous fed frame, capped at one frame interval at the slowest
// measurable rate, so duplicates of a photograph are never more
// evidence than the photograph, and a frame after a face loss
// vouches for one interval, not for the loss.
//
// One rule, three readers: the baseline floor, the guided phase
// floors, and the exported faceSeconds column all accumulate through
// this module, so what "face seen" means cannot drift between them.
// blinkRate.ts keeps its own windowed variant on purpose — its
// observation expires with the rate window; this one never does.

/**
 * The most observation one fed frame can vouch for, derived from
 * MIN_BLINK_FPS rather than chosen.
 */
export const FACE_TIME_FRAME_CREDIT_MS = 1000 / MIN_BLINK_FPS;

export type FaceTimeState = {
  faceMs: number;
  lastFedAtMs: number | null;
};

export const initialFaceTime: FaceTimeState = {
  faceMs: 0,
  lastFedAtMs: null,
};

/**
 * One frame's worth of face time, credited only when the frame was
 * fed a trusted aperture. Backwards clocks and unfed frames leave
 * the state untouched, the house rules.
 */
export function tickFaceTime(
  state: FaceTimeState,
  nowMs: number,
  fedAperture: boolean,
): FaceTimeState {
  if (!fedAperture) {
    return state;
  }
  if (state.lastFedAtMs !== null && nowMs < state.lastFedAtMs) {
    return state;
  }
  const creditMs =
    state.lastFedAtMs === null
      ? 0
      : Math.min(nowMs - state.lastFedAtMs, FACE_TIME_FRAME_CREDIT_MS);
  return { faceMs: state.faceMs + creditMs, lastFedAtMs: nowMs };
}
