import {
  CALIBRATION_SAMPLES_PER_TARGET,
  CALIBRATION_SETTLE_MS,
} from "./constants";
import type { IrisOffset } from "./gazeOffset";

// The capture half of calibration: nine known dots, thirty trusted
// samples each. The solver that turns these pairs into a mapping is
// 5.4b's job, this reducer only collects honestly: nothing counts
// during the settle window while the eye travels, and invalid frames
// never count at all.
export type CalibrationTarget = {
  x: number;
  y: number;
};

// A three by three grid in viewport fractions.
export const CALIBRATION_TARGETS: readonly CalibrationTarget[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

export type CompletedTarget = {
  target: CalibrationTarget;
  samples: IrisOffset[];
};

export type CalibrationCapture = {
  targetIndex: number;
  targetStartedAtMs: number;
  currentSamples: IrisOffset[];
  completed: CompletedTarget[];
};

export function startCapture(nowMs: number): CalibrationCapture {
  return {
    targetIndex: 0,
    targetStartedAtMs: nowMs,
    currentSamples: [],
    completed: [],
  };
}

export function isCaptureDone(state: CalibrationCapture): boolean {
  return state.targetIndex >= CALIBRATION_TARGETS.length;
}

export function captureStep(
  state: CalibrationCapture,
  nowMs: number,
  offset: IrisOffset | null,
): CalibrationCapture {
  if (isCaptureDone(state)) {
    return state;
  }
  if (nowMs - state.targetStartedAtMs <= CALIBRATION_SETTLE_MS) {
    return state;
  }
  if (offset === null) {
    return state;
  }
  const currentSamples = [...state.currentSamples, offset];
  if (currentSamples.length < CALIBRATION_SAMPLES_PER_TARGET) {
    return { ...state, currentSamples };
  }
  const target = CALIBRATION_TARGETS[state.targetIndex];
  if (target === undefined) {
    return state;
  }
  return {
    targetIndex: state.targetIndex + 1,
    targetStartedAtMs: nowMs,
    currentSamples: [],
    completed: [...state.completed, { target, samples: currentSamples }],
  };
}
