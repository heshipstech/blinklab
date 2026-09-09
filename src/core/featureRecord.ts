import { LINE_SOURCES, type LineSource } from "./lineProvenance";

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
  // Pupil diameter in millimetres through the iris ruler (9.2/9.3), or
  // null the moment the estimator cannot resolve a pupil this frame,
  // which on a webcam is often: null-never-zero, like every field here.
  pupilDiameterMm: number | null;
  // The two lines the detectors actually read this frame, and where
  // each came from (10.13a, ladder A8). A blink is counted when the
  // aperture crosses blinkLineMm, and the duration, amplitude and
  // velocity above are all measured from that crossing, so a row that
  // carries them without the line carries an answer without its
  // question. `source` is `none` on a frame where nothing was
  // compared, which is a measured fact and not a missing value.
  blinkLineMm: number | null;
  blinkLineSource: LineSource;
  shutLineMm: number | null;
  shutLineSource: LineSource;
  // How measurement happened, per row rather than once per session
  // (roadmap 12.15). `sampledFps` is the EVIDENCE rate: distinct
  // camera frames read per second, which is what the 25 fps refusal
  // and the 60 fps warning both judge, and it is not `fps` above,
  // which is the processing rate. The session's comment line reports
  // one number for a recording that may have run at 30 for a minute
  // and 12 for the next; these columns say which rows are which.
  // Null on a clip, where there is no camera delivering, and null on
  // a camera the browser cannot report delivery for: measured absence
  // either way, never the display's pace.
  sampledFps: number | null;
  // How long the face model took on this frame, in milliseconds. The
  // processing rate is set by that call, so a row reporting a low
  // `fps` says the machine was slow without saying whether the model
  // or the rest of the loop was the reason. Null on a frame where no
  // inference ran.
  inferenceMs: number | null;
  // How much light the camera thinks it is seeing, in [0,1], from one
  // downscaled raster of the whole frame (roadmap 12.16). `sceneLum`
  // is the mean over all of it, `faceLum` the mean over the box the
  // face lands in. THE CAMERA'S RENDERING OF LIGHT AND NOT LUX: a
  // webcam's automatic exposure and white balance act before this is
  // read, so a bright room and a compensated dim one can arrive
  // looking alike. No threshold and no adjective attach to either
  // until something has been measured against an outcome, which is
  // row 13.6b. Both null when the frame cannot be read, and `faceLum`
  // null with no trusted face or a face too small for the raster to
  // resolve. Null is a refusal: a fully black frame reads 0, because
  // a lens cap is a measurement and a failed read is not.
  sceneLum: number | null;
  faceLum: number | null;
  // Roadmap 10.12b. How much of the rate's rolling window was
  // actually observed, 0 to 1: `blinkRatePerMin` above divides by
  // fed-frame time rather than the wall clock, and this says how
  // much of the window that was — a rate over a third of the window
  // is a different fact from the same rate over all of it. Null
  // before any wall time has passed.
  blinkObservedFraction: number | null;
  // Whether blink counting was suspended this frame: the eye closed
  // past the longest thing the detector calls a blink, or the
  // re-arm gate down because the eye never rose clearly above the
  // line. A blink on a `true` row would not have been counted, so
  // this is the flag that keeps a quiet stretch from reading as
  // calm eyes.
  blinkCountingSuspended: boolean;
  // Where the iris sits vertically in its eye, in eye widths,
  // positive downward — gazeOffset's own signal, the mean of both
  // eyes. A lid drooping because the eyes LOOK DOWN carries the
  // iris down with it; a lid drooping over a level iris is the
  // drowsy kind; in the aperture alone the two are the same number.
  // Null with no trusted face.
  irisOffsetVertical: number | null;
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

// A luminance is a fraction of full scale, so a value outside [0,1]
// is not a luminance and must not reach a file. Tighter than
// nonNegativeOrNull on purpose: 1.5 would pass that one, and a reader
// would have no way to know the column had stopped meaning what its
// header says.
function fractionOrNull(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1)
  );
}

function booleanOrNull(value: unknown): boolean {
  return value === null || typeof value === "boolean";
}

// A provenance string, checked against the committed vocabulary rather
// than against `typeof === "string"`. A row claiming a source nobody
// defined would load, plot and mean nothing.
function isLineSource(value: unknown): value is LineSource {
  return (
    typeof value === "string" &&
    (LINE_SOURCES as readonly string[]).includes(value)
  );
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
    booleanOrNull(record.onScreen) &&
    nonNegativeOrNull(record.pupilDiameterMm) &&
    numberOrNull(record.blinkLineMm) &&
    isLineSource(record.blinkLineSource) &&
    numberOrNull(record.shutLineMm) &&
    isLineSource(record.shutLineSource) &&
    // Both non-negative: a negative rate and a negative duration are
    // each a defect upstream rather than a measurement, and the
    // schema is where this project refuses one (roadmap 12.15).
    nonNegativeOrNull(record.sampledFps) &&
    nonNegativeOrNull(record.inferenceMs) &&
    fractionOrNull(record.blinkObservedFraction) &&
    typeof record.blinkCountingSuspended === "boolean" &&
    numberOrNull(record.irisOffsetVertical) &&
    fractionOrNull(record.sceneLum) &&
    fractionOrNull(record.faceLum)
  );
}
