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

// Four decimals keep about a tenth of a pixel of precision and cut
// the fixture file to a fifth of its full precision size.
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
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
