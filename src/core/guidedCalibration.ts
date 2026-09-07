import {
  GUIDED_CALIBRATION_MIN_SAMPLES,
  GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
  GUIDED_CALIBRATION_PHASE_MS,
} from "./constants";
import { percentile } from "./statistics";

export { GUIDED_CALIBRATION_PHASE_MS };

// Guided blink-line calibration: measure a person's OWN open and
// closed aperture through two held phases, then place the personal
// line in the real gap between them. The passive baseline (baseline.ts)
// learns only the open eye and assumes closed is near zero, so it puts
// the line at half of open; a guided run measures the real closed value
// and can place the line where this person's lids actually travel.
//
// A refused calibration is a result, not an accident, the same stance
// baseline.ts takes: rather than a guessed line, three refusals name
// what went wrong.

/** Which held phase a reading belongs to. */
export type CalibrationPhase = "open" | "closed";

/** The apertures collected in each phase, in millimetres. */
export type GuidedCalibrationSamples = {
  open: readonly number[];
  closed: readonly number[];
};

export const emptyGuidedCalibration: GuidedCalibrationSamples = {
  open: [],
  closed: [],
};

export type GuidedCalibrationRefusal =
  // Fewer than the minimum trusted readings in the open phase.
  | "not-enough-open"
  // Fewer than the minimum trusted readings in the closed phase.
  | "not-enough-closed"
  // The closed median was not clearly below the open one: the
  // instrument did not register this person's deliberate closure, the
  // personal echo of the corpus recall ceiling (docs/iris-occlusion.txt).
  | "closure-not-registered";

export type GuidedCalibrationResult =
  | {
      kind: "ready";
      openMedianMm: number;
      closedMedianMm: number;
      personalLineMm: number;
      // How many trusted readings each median stood on. Carried out of
      // the resolver rather than recounted at the call site, so the
      // exported counts describe the samples that produced the line
      // (roadmap 10.13a, ladder A8).
      openSampleCount: number;
      closedSampleCount: number;
    }
  | { kind: "refused"; reason: GuidedCalibrationRefusal };

/**
 * Append one trusted aperture reading to the phase in progress.
 *
 * A null aperture (no trusted face on that frame) is dropped, not
 * stored: the calibration is built only from frames that carried a
 * real measurement, so a face that came and went cannot pad a phase
 * toward its minimum with nothing.
 */
export function collectCalibrationSample(
  samples: GuidedCalibrationSamples,
  phase: CalibrationPhase,
  apertureMm: number | null,
): GuidedCalibrationSamples {
  if (apertureMm === null) {
    return samples;
  }
  return phase === "open"
    ? { ...samples, open: [...samples.open, apertureMm] }
    : { ...samples, closed: [...samples.closed, apertureMm] };
}

/**
 * Resolve the two phases into a personal blink line, or a refusal.
 *
 * The line is the midpoint of the person's own open and closed
 * median. It refuses when either phase is too short, or when the
 * closed median is not at least GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION
 * below the open one — a gap too small means the closure never
 * reached the landmarks, and a line drawn from it would be a guess.
 */
export function resolveGuidedCalibration(
  samples: GuidedCalibrationSamples,
): GuidedCalibrationResult {
  if (samples.open.length < GUIDED_CALIBRATION_MIN_SAMPLES) {
    return { kind: "refused", reason: "not-enough-open" };
  }
  if (samples.closed.length < GUIDED_CALIBRATION_MIN_SAMPLES) {
    return { kind: "refused", reason: "not-enough-closed" };
  }
  const openMedianMm = percentile(samples.open, 50);
  const closedMedianMm = percentile(samples.closed, 50);
  if (openMedianMm === null || closedMedianMm === null) {
    // Unreachable given the length checks above, but a null median is
    // never answered with a guessed number: the types demand a branch
    // and it refuses.
    return { kind: "refused", reason: "not-enough-open" };
  }
  if (
    closedMedianMm >
    openMedianMm * (1 - GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION)
  ) {
    return { kind: "refused", reason: "closure-not-registered" };
  }
  return {
    kind: "ready",
    openMedianMm,
    closedMedianMm,
    personalLineMm: (openMedianMm + closedMedianMm) / 2,
    openSampleCount: samples.open.length,
    closedSampleCount: samples.closed.length,
  };
}

/**
 * The conditions one stored line was measured under.
 *
 * Added 7 September 2026 (roadmap 10.13a, ladder A8). A line that
 * overrides the passive baseline for as long as it exists was three
 * bare numbers, with nothing saying which camera measured it, at what
 * size, how far away, or when. The export carries these now, and the
 * live camera is checked against them.
 */
export type BlinkCalibrationStampFields = {
  /** The camera's own name, or null when the browser withheld it. */
  cameraLabel: string | null;
  frameWidthPx: number;
  frameHeightPx: number;
  /**
   * The iris ruler at the moment of calibration: the working distance.
   *
   * Null when it could not be measured on that frame. Null and never
   * zero, the same rule the rest of the record keeps: a zero ruler is
   * not a small distance, it is no measurement, and storing one would
   * make a line that cannot be checked look like one that matches
   * nothing.
   */
  irisWidthPx: number | null;
  recordedAtIso: string;
};

// What a resolved calibration keeps: the line, the two medians it came
// from, how many samples each median stood on, and the conditions of
// the measurement — so a stored calibration can show its working, not
// just a bare number.
export type StoredBlinkCalibration = {
  personalLineMm: number;
  openMedianMm: number;
  closedMedianMm: number;
  openSampleCount: number;
  closedSampleCount: number;
  stamp: BlinkCalibrationStampFields;
};

export function serializeBlinkCalibration(
  calibration: StoredBlinkCalibration,
): string {
  return JSON.stringify(calibration);
}

/**
 * Which blink line the detector should read this frame.
 *
 * The whole of the adoption change, kept as one pure decision: a stored
 * guided line — a person's own measured open-to-closed midpoint — wins
 * when it exists, because it is a complete ruler that needs no passive
 * baseline; otherwise the passive baseline line stands, and null when
 * there is no line at all yet.
 *
 * The corpus runner starts each clip in a fresh browser with no stored
 * calibration, so `stored` is null there and this returns the baseline
 * line unchanged: the Eyeblink8 benchmark cannot reach the guided path
 * and is neutral by construction (docs/blink-line-adoption.txt).
 */
export function effectiveBlinkLineMm(
  stored: StoredBlinkCalibration | null,
  baselineLineMm: number | null,
): number | null {
  return stored !== null ? stored.personalLineMm : baselineLineMm;
}

/**
 * The stamp, or null for anything that is not one.
 *
 * As strict as the rest of this parser, which means an entry stored
 * before 7 September 2026 is refused whole. That is deliberate: a line
 * whose conditions nobody recorded cannot be checked against the
 * camera in front of it, and being used anyway is the defect this row
 * exists to close. The cost is one recalibration, once.
 */
function parseStamp(value: unknown): BlinkCalibrationStampFields | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const stamp = value as Record<string, unknown>;
  const { frameWidthPx, frameHeightPx, irisWidthPx, recordedAtIso } = stamp;
  if (!finitePositive(frameWidthPx) || !finitePositive(frameHeightPx)) {
    return null;
  }
  if (irisWidthPx !== null && !finitePositive(irisWidthPx)) {
    return null;
  }
  if (typeof recordedAtIso !== "string" || recordedAtIso.length === 0) {
    return null;
  }
  const label = stamp.cameraLabel;
  if (label !== null && typeof label !== "string") {
    return null;
  }
  return {
    cameraLabel: label,
    frameWidthPx,
    frameHeightPx,
    irisWidthPx: irisWidthPx as number | null,
    recordedAtIso,
  };
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Parse a stored calibration, or null for anything that is not one.
 *
 * Unlike the gaze profile store, which casts raw JSON and trusts it,
 * this validates: non-JSON, a missing or non-finite field, or a line
 * that does not sit strictly between the closed and open medians all
 * return null. That last check is the point — a line outside the
 * bracket its own medians define is a tampered or stale-format entry,
 * and a stale line is exactly what must never quietly become the
 * detector's threshold.
 */
export function parseBlinkCalibration(
  raw: string,
): StoredBlinkCalibration | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { personalLineMm, openMedianMm, closedMedianMm } = record;
  if (
    !finitePositive(personalLineMm) ||
    !finitePositive(openMedianMm) ||
    !finitePositive(closedMedianMm)
  ) {
    return null;
  }
  if (!(closedMedianMm < personalLineMm && personalLineMm < openMedianMm)) {
    return null;
  }
  const { openSampleCount, closedSampleCount } = record;
  if (!finitePositive(openSampleCount) || !finitePositive(closedSampleCount)) {
    return null;
  }
  const stamp = parseStamp(record.stamp);
  if (stamp === null) {
    return null;
  }
  return {
    personalLineMm,
    openMedianMm,
    closedMedianMm,
    openSampleCount,
    closedSampleCount,
    stamp,
  };
}

// The session sequences the two held phases against the clock, so the
// DOM only has to render the phase and feed apertures. Open first,
// then closed, each for GUIDED_CALIBRATION_PHASE_MS, then it resolves
// once and freezes — a calibration, like the baseline, is measured and
// then used, never re-opened mid-run.
export type CalibrationSessionState =
  | {
      kind: "collecting";
      phase: CalibrationPhase;
      startedAtMs: number;
      samples: GuidedCalibrationSamples;
    }
  | { kind: "done"; result: GuidedCalibrationResult };

export function startCalibrationSession(
  nowMs: number,
): CalibrationSessionState {
  return {
    kind: "collecting",
    phase: "open",
    startedAtMs: nowMs,
    samples: emptyGuidedCalibration,
  };
}

export function calibrationSessionStep(
  state: CalibrationSessionState,
  nowMs: number,
  apertureMm: number | null,
): CalibrationSessionState {
  if (state.kind === "done") {
    return state;
  }
  // A frame stamped before the phase began cannot lengthen it: a
  // backwards clock is ignored, state unchanged (baseline.ts's guard,
  // remediation C3).
  if (nowMs < state.startedAtMs) {
    return state;
  }
  const samples = collectCalibrationSample(
    state.samples,
    state.phase,
    apertureMm,
  );
  if (nowMs - state.startedAtMs < GUIDED_CALIBRATION_PHASE_MS) {
    return { ...state, samples };
  }
  if (state.phase === "open") {
    return { kind: "collecting", phase: "closed", startedAtMs: nowMs, samples };
  }
  return { kind: "done", result: resolveGuidedCalibration(samples) };
}
