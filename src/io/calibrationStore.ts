import type { CompletedTarget } from "../core/calibrationCapture";
import {
  parseCalibrationProfile,
  type CalibrationProfile,
} from "../core/calibrationProfile";
import {
  parseBlinkCalibration,
  serializeBlinkCalibration,
  type StoredBlinkCalibration,
} from "../core/guidedCalibration";
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
const PSEUDONYM_KEY = "blinklab-participant-pseudonym-v1";
const BLINK_CALIBRATION_KEY = "blinklab-blink-calibration-v1";

// Everything this page stores, in one array, so the probe and the
// erase below cannot fall out of step with the keys above. The
// visitor-facing descriptions live in core/storedData.ts. A key that
// can be written but is missing here would be undeletable from the
// erase control and undocumented in the enumeration, the exact E3
// defect, so a new save function and a new entry here arrive together.
const ALL_KEYS = [
  PROFILE_KEY,
  STORAGE_KEY,
  PSEUDONYM_KEY,
  BLINK_CALIBRATION_KEY,
] as const;

/**
 * The saved pseudonym, or null. A failed read reports null here —
 * the page then simply shows no pseudonym — while the probe above
 * reports the same failure as UNREADABLE, because a privacy control
 * that says "nothing stored" when it was refused permission to look
 * has told the one lie it exists to prevent. Same split as the
 * calibration loaders.
 */
export function loadPseudonym(): string | null {
  try {
    return localStorage.getItem(PSEUDONYM_KEY);
  } catch (error: unknown) {
    console.warn("the pseudonym could not be read:", error);
    return null;
  }
}

/** Save, or say it did not survive. Created only by explicit action. */
export function savePseudonym(value: string): boolean {
  try {
    localStorage.setItem(PSEUDONYM_KEY, value);
    return true;
  } catch (error: unknown) {
    console.warn("the pseudonym could not be saved:", error);
    return false;
  }
}

/** Remove only the pseudonym: saving an empty field is this action. */
export function removePseudonym(): void {
  try {
    localStorage.removeItem(PSEUDONYM_KEY);
  } catch (error: unknown) {
    console.warn("the pseudonym could not be removed:", error);
  }
}

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
  // The validated boundary, not a bare cast: a stored value that parses
  // but is the wrong shape used to become a mapping that returned NaN
  // for every gaze point. parseCalibrationProfile returns null for it,
  // and the page then simply shows as uncalibrated.
  return parseCalibrationProfile(raw);
}

/**
 * Save a guided blink calibration, or say the write did not survive.
 *
 * The same B3 guard as the profile store: a full quota throws on write,
 * and this will be called from inside the frame loop, where an
 * unguarded throw would end the whole measurement session rather than
 * lose one calibration.
 */
export function saveBlinkCalibration(
  calibration: StoredBlinkCalibration,
): boolean {
  try {
    localStorage.setItem(
      BLINK_CALIBRATION_KEY,
      serializeBlinkCalibration(calibration),
    );
    return true;
  } catch (error: unknown) {
    console.warn("the blink calibration could not be stored:", error);
    return false;
  }
}

/**
 * The saved blink calibration, or null for anything that is not one.
 *
 * Unlike loadCalibrationProfile above, which casts raw JSON and trusts
 * it, this runs parseBlinkCalibration: a stored line that no longer
 * sits between its own open and closed medians is a tampered or
 * stale-format entry, and returning null keeps a stale line from
 * quietly becoming the detector's threshold. A failed read is null too,
 * the same as the loaders above.
 */
export function loadBlinkCalibration(): StoredBlinkCalibration | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(BLINK_CALIBRATION_KEY);
  } catch (error: unknown) {
    console.warn("the blink calibration could not be read:", error);
    return null;
  }
  if (raw === null) {
    return null;
  }
  return parseBlinkCalibration(raw);
}
