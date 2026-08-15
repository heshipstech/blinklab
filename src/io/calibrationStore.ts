import type { CompletedTarget } from "../core/calibrationCapture";
import type { CalibrationProfile } from "../core/calibrationProfile";
import type { StorageProbe } from "../core/storedData";

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

// Everything this page stores, in one array, so the probe and the
// erase below cannot fall out of step with the two keys above. The
// visitor-facing descriptions live in core/storedData.ts.
const ALL_KEYS = [PROFILE_KEY, STORAGE_KEY] as const;

/**
 * What the browser is actually holding right now.
 *
 * A key whose read THREW is reported as unreadable, not as absent.
 * The loaders above deliberately treat a failed read as "nothing
 * stored", which is right for them, because the page then shows
 * itself as uncalibrated and everything downstream still works. It
 * would be badly wrong here: a privacy control that says "nothing is
 * stored" because it was refused permission to look has told the one
 * lie it exists to prevent.
 */
export function probeStoredData(): StorageProbe {
  const present: string[] = [];
  const unreadable: string[] = [];
  for (const key of ALL_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        present.push(key);
      }
    } catch (error: unknown) {
      console.warn(`stored data could not be read for ${key}:`, error);
      unreadable.push(key);
    }
  }
  return { present, unreadable };
}

/**
 * Erase everything this page stores, then RE-PROBE and return what is
 * actually left.
 *
 * The return value comes from reading the storage back, never from
 * whether removeItem threw. A remove that returns quietly and changes
 * nothing is precisely the failure this project keeps rediscovering,
 * and the caller can only speak honestly about the result if the
 * result was measured rather than assumed.
 */
export function eraseStoredData(): StorageProbe {
  for (const key of ALL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (error: unknown) {
      console.warn(`stored data could not be erased for ${key}:`, error);
    }
  }
  return probeStoredData();
}

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
  } catch (error: unknown) {
    // Returning null is right — a corrupt entry should behave as no
    // entry. The silence was not: "stored but unreadable" and "nothing
    // stored" were indistinguishable, while the localStorage catch a
    // few lines above already warns for the same class of failure.
    console.warn("stored calibration samples were unreadable:", error);
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
  } catch (error: unknown) {
    // Same reasoning as loadCalibrationSamples above: null is the right
    // return, silence was not.
    console.warn("stored calibration profile was unreadable:", error);
    return null;
  }
}
