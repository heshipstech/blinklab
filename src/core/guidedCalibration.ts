import {
  GUIDED_CALIBRATION_MIN_SAMPLES,
  GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
} from "./constants";
import { percentile } from "./statistics";

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
  };
}
