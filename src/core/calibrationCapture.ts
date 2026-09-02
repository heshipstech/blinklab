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

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseTarget(value: unknown): CalibrationTarget | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!finiteNumber(record.x) || !finiteNumber(record.y)) {
    return null;
  }
  return { x: record.x, y: record.y };
}

function parseOffset(value: unknown): IrisOffset | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!finiteNumber(record.horizontal) || !finiteNumber(record.vertical)) {
    return null;
  }
  return { horizontal: record.horizontal, vertical: record.vertical };
}

/**
 * Parse stored calibration samples, or null for anything that is not
 * them.
 *
 * The sibling of parseCalibrationProfile: the samples store also cast
 * its JSON, `JSON.parse(raw) as CompletedTarget[]`, and trusted
 * whatever came back, so a value that parsed but was the wrong shape
 * would be re-solved into a gaze profile. This is the validated
 * boundary that replaces the cast. Every target and every sample is
 * checked for shape and finiteness; a single bad entry rejects the
 * whole array rather than solving from a half-trusted one. An empty
 * array is valid — a fresh save round-trips one — but a non-array, or a
 * malformed entry anywhere, reads as no samples, which the page already
 * shows honestly as uncalibrated.
 */
export function parseCalibrationSamples(raw: string): CompletedTarget[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const completed: CompletedTarget[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const target = parseTarget(record.target);
    if (target === null || !Array.isArray(record.samples)) {
      return null;
    }
    const samples: IrisOffset[] = [];
    for (const sample of record.samples) {
      const offset = parseOffset(sample);
      if (offset === null) {
        return null;
      }
      samples.push(offset);
    }
    completed.push({ target, samples });
  }
  return completed;
}
