// The feature vector: everything the lab measures, assembled into
// one typed row per second. Displays forget; records can be scored
// (6.5), exported (6.7), and audited (Phase 7). Every field is
// honestly nullable where its source gate can refuse, because a
// record that invents numbers is worse than no record at all.
// Durations come from timestamp spans, never from row counts: the
// cadence is about one row per second, not exactly.
//
// This is the FeatureRecord SPEC.md seeded on day one with three
// fields and a plan to grow one field per increment. The fields did
// each arrive through their increments; 6.4 is where they assemble,
// and SPEC.md now records the full contract.
// How many rows the session keeps, and therefore how many rows the
// export can hold: about an hour at one row per second, oldest
// dropped first. Lives here rather than as a literal at the push
// site because rulerFit.ts must bound its aperture series by the
// SAME number — the published baseline_over_resting check reads the
// file, and a live series that remembered more rows than the file
// keeps would quietly stop agreeing with it in any session longer
// than the buffer.
export const FEATURE_RECORD_CAP = 3600;

export type FeatureRecord = {
  timestampMs: number;
  // True when a face was present AND the landmark count was valid
  // this frame. False rows carry nulls: measured absence, not
  // missing data.
  faceDetected: boolean;
  fps: number | null;
  apertureMm: number | null;
  // The live 4.2 baseline serving the blink line, and the frozen
  // first-ready baseline serving the shut line (PERCLOS and long
  // closures). Both recorded, because both explain numbers here.
  baselineMm: number | null;
  shutBaselineMm: number | null;
  // The validation round's fifth check, computed live: the baseline
  // over the median aperture of the records SO FAR, so the final
  // row of a session is the same number the round's table published
  // for it (for sessions within the record cap). Null until the
  // baseline is born. src/core/rulerFit.ts is the account.
  baselineOverResting: number | null;
  blinkRatePerMin: number | null;
  lastBlinkDurationMs: number | null;
  lastBlinkAmplitudeMm: number | null;
  lastBlinkPeakVelocityMmPerS: number | null;
  perclos: number | null;
  longClosureCount: number;
  fixationCount: number | null;
  fixationMedianMs: number | null;
  fixating: boolean | null;
  onScreen: boolean | null;
};

// The assembler is the identity with a type, and that is the point:
// it forces every caller to supply every field, so a new metric
// cannot be forgotten silently when it joins the record. It returns
// a fresh object every call; rows in a buffer must never share.
export function assembleFeatureRecord(fields: FeatureRecord): FeatureRecord {
  return { ...fields };
}

// A finite number or null: NaN is a number to typeof and a lie to
// arithmetic, and Infinity is no better, so both are refused
// everywhere a number lives. A missing key arrives as undefined and
// fails here too, which is what makes every key required.
function numberOrNull(value: unknown): boolean {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

function nonNegativeOrNull(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function booleanOrNull(value: unknown): boolean {
  return value === null || typeof value === "boolean";
}

// The runtime schema behind the 6.7 serializer and the 7.2 loader.
// Extra keys are tolerated DELIBERATELY: a future field must not
// make old records unreadable. Missing or malformed keys are not.
export function isFeatureRecord(value: unknown): value is FeatureRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.timestampMs === "number" &&
    Number.isFinite(record.timestampMs) &&
    typeof record.faceDetected === "boolean" &&
    numberOrNull(record.fps) &&
    numberOrNull(record.apertureMm) &&
    numberOrNull(record.baselineMm) &&
    numberOrNull(record.shutBaselineMm) &&
    nonNegativeOrNull(record.baselineOverResting) &&
    nonNegativeOrNull(record.blinkRatePerMin) &&
    nonNegativeOrNull(record.lastBlinkDurationMs) &&
    nonNegativeOrNull(record.lastBlinkAmplitudeMm) &&
    nonNegativeOrNull(record.lastBlinkPeakVelocityMmPerS) &&
    (record.perclos === null ||
      (typeof record.perclos === "number" &&
        Number.isFinite(record.perclos) &&
        record.perclos >= 0 &&
        record.perclos <= 1)) &&
    typeof record.longClosureCount === "number" &&
    Number.isFinite(record.longClosureCount) &&
    record.longClosureCount >= 0 &&
    nonNegativeOrNull(record.fixationCount) &&
    nonNegativeOrNull(record.fixationMedianMs) &&
    booleanOrNull(record.fixating) &&
    booleanOrNull(record.onScreen)
  );
}
