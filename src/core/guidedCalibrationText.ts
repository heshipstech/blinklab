import {
  GUIDED_CALIBRATION_MIN_SAMPLES,
  GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
} from "./constants";

// What a person is shown after a guided calibration stores their line
// (roadmap 11.6b): the numbers it stood on, and a plain warning when a
// run cleared its floors with little to spare. Pure wording over
// numbers — the resolver already decided the line is sound; this
// module only says how comfortably.

/**
 * How far above a floor a reading must sit before the run stops being
 * called thin.
 *
 * One factor over both floors rather than a margin per quantity: a
 * run that cleared any floor by less than a third of the floor itself
 * was one stretch of bad luck — a look away, a lighting dip — from a
 * refusal, and its line deserves less trust than the stored record
 * alone can show. At the sample floor of 30 this puts the thin line
 * at 40 readings; at the separation floor of 0.30, at 0.40. It lives
 * here and not in constants.ts deliberately: it moves no threshold
 * the detector reads, only when a sentence appears.
 */
export const GUIDED_CALIBRATION_THIN_FACTOR = 4 / 3;

/** The numbers a stored calibration stood on, as the display reads them. */
export type CalibrationResultReading = {
  openSampleCount: number;
  closedSampleCount: number;
  /** From `separationRatio()`: null when it could not be computed. */
  separationRatio: number | null;
};

/**
 * The sentence every successful calibration shows: n_open, n_closed
 * and the separation as a percentage. An uncomputable separation says
 * so rather than rendering a number that was never measured.
 */
export function calibrationResultLine(
  reading: CalibrationResultReading,
): string {
  const counts = `Measured from ${String(reading.openSampleCount)} open and ${String(reading.closedSampleCount)} closed readings`;
  if (reading.separationRatio === null) {
    return `${counts}; the separation could not be computed.`;
  }
  return `${counts}; your closed eyes read ${percent(reading.separationRatio)} below your open ones.`;
}

/**
 * The thin warning, or null for a run with comfortable margins.
 *
 * Each quantity below its thin line is named with the floor it barely
 * cleared, so the person knows WHAT was thin, not just that something
 * was. A null separation is never called thin: null means not
 * measured, and thinness is a verdict on a measurement.
 */
export function calibrationThinNote(
  reading: CalibrationResultReading,
): string | null {
  const thin: string[] = [];
  const sampleLine =
    GUIDED_CALIBRATION_MIN_SAMPLES * GUIDED_CALIBRATION_THIN_FACTOR;
  if (reading.openSampleCount < sampleLine) {
    thin.push(
      `${String(reading.openSampleCount)} open readings against the ${String(GUIDED_CALIBRATION_MIN_SAMPLES)} it needs`,
    );
  }
  if (reading.closedSampleCount < sampleLine) {
    thin.push(
      `${String(reading.closedSampleCount)} closed readings against the ${String(GUIDED_CALIBRATION_MIN_SAMPLES)} it needs`,
    );
  }
  if (
    reading.separationRatio !== null &&
    reading.separationRatio <
      GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION *
        GUIDED_CALIBRATION_THIN_FACTOR
  ) {
    thin.push(
      `a separation of ${percent(reading.separationRatio)} against the ${percent(GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION)} floor`,
    );
  }
  if (thin.length === 0) {
    return null;
  }
  return `This measurement is thin — ${thin.join(", ")} — consider running it again.`;
}

function percent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
}
