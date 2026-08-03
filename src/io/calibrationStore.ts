import type { CompletedTarget } from "../core/calibrationCapture";
import type { CalibrationProfile } from "../core/calibrationProfile";

// The calibration samples and the solved profile live in this
// browser's local storage and nowhere else, consistent with the
// privacy stance: nothing leaves the device.
const STORAGE_KEY = "blinklab-calibration-samples-v1";
const PROFILE_KEY = "blinklab-calibration-profile-v1";

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

export function saveCalibrationProfile(profile: CalibrationProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadCalibrationProfile(): CalibrationProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as CalibrationProfile;
  } catch {
    return null;
  }
}
