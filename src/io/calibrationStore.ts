import type { CompletedTarget } from "../core/calibrationCapture";

// The calibration samples live in this browser's local storage and
// nowhere else, consistent with the privacy stance: nothing leaves
// the device.
const STORAGE_KEY = "blinklab-calibration-samples-v1";

export function saveCalibrationSamples(
  completed: readonly CompletedTarget[],
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
}

export function loadCalibrationSamples(): CompletedTarget[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as CompletedTarget[];
  } catch {
    return null;
  }
}
