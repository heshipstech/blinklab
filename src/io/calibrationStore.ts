import type { CompletedTarget } from "../core/calibrationCapture";
import type { CalibrationProfile } from "../core/calibrationProfile";

// The calibration samples and the solved profile live in this
// browser's local storage and nowhere else, consistent with the
// privacy stance: nothing leaves the device.
//
// Every operation here is guarded, because localStorage is allowed
// to throw: reading it throws under Safari's lockdown modes and
// blocked-storage settings, and writing it throws when the quota is
// full. Remediation B3. These writes and reads happen inside the
// frame loop, so before the guards a storage exception did not lose
// a profile, it killed the whole measurement session. A failed read
// reports as "nothing stored", which the page already shows honestly
// as uncalibrated; a failed write returns false so the caller can
// say, visibly, that the profile will not survive a reload.
const STORAGE_KEY = "blinklab-calibration-samples-v1";
const PROFILE_KEY = "blinklab-calibration-profile-v1";

export function saveCalibrationSamples(
  completed: readonly CompletedTarget[],
): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    return true;
  } catch (error: unknown) {
    console.warn("calibration samples could not be stored:", error);
    return false;
  }
}

export function loadCalibrationSamples(): CompletedTarget[] | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error: unknown) {
    console.warn("calibration samples could not be read:", error);
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as CompletedTarget[];
  } catch {
    return null;
  }
}

export function saveCalibrationProfile(profile: CalibrationProfile): boolean {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch (error: unknown) {
    console.warn("calibration profile could not be stored:", error);
    return false;
  }
}

export function loadCalibrationProfile(): CalibrationProfile | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PROFILE_KEY);
  } catch (error: unknown) {
    console.warn("calibration profile could not be read:", error);
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as CalibrationProfile;
  } catch {
    return null;
  }
}
