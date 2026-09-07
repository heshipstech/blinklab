export type FixtureLandmark = {
  x: number;
  y: number;
  z: number;
};

export type FixtureFrame = {
  timestampMs: number;
  landmarks: FixtureLandmark[];
};

export type RecordingState = {
  targetFrames: number;
  frames: FixtureFrame[];
};

export function startRecording(targetFrames: number): RecordingState {
  return { targetFrames, frames: [] };
}

export function addFrame(
  state: RecordingState,
  frame: FixtureFrame,
): RecordingState {
  if (state.frames.length >= state.targetFrames) {
    return state;
  }
  return { ...state, frames: [...state.frames, frame] };
}

export function isComplete(state: RecordingState): boolean {
  return state.frames.length >= state.targetFrames;
}

/**
 * The stored grid every landmark is rounded onto.
 *
 * Four decimals keep about a tenth of a pixel of precision and cut the
 * fixture file to a fifth of its full precision size. Exported because
 * what that rounding is worth in millimetres is a published figure
 * (docs/fixture-storage-quantum.txt, roadmap 10.10c4e), and a figure
 * derived from a number typed beside this one could drift away from
 * the rounding it claims to describe.
 */
export const FIXTURE_COORDINATE_QUANTUM = 1e-4;

const STEPS_PER_UNIT = 1 / FIXTURE_COORDINATE_QUANTUM;

function round4(value: number): number {
  return Math.round(value * STEPS_PER_UNIT) / STEPS_PER_UNIT;
}

export function serializeFixture(state: RecordingState): string {
  return JSON.stringify({
    landmarkCountPerFrame: state.frames[0]?.landmarks.length ?? 0,
    frameCount: state.frames.length,
    frames: state.frames.map((frame) => ({
      timestampMs: round4(frame.timestampMs),
      landmarks: frame.landmarks.map((landmark) => [
        round4(landmark.x),
        round4(landmark.y),
        round4(landmark.z),
      ]),
    })),
  });
}
