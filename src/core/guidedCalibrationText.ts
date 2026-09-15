import {
  GUIDED_CALIBRATION_MIN_SAMPLES,
  GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
} from "./constants";
import type { GuidedCalibrationRefusal } from "./guidedCalibration";
import { percentile } from "./statistics";

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

/**
 * Below this, a second-half closed median relative to the first half's
 * reads as eyes that closed LATE rather than eyes that cannot
 * separate: the trace itself fell by more than half across the hold.
 * Half, because the refusal it refines fires when closed fails to sit
 * 30% below open — a within-phase drop of 50% is well past anything
 * that gate would have refused, so it cannot be the non-separation
 * case wearing a different hat.
 */
export const LATE_CLOSURE_DROP_FACTOR = 0.5;

/**
 * A strict majority of a phase's frames carrying no measured aperture
 * is when the detail blames the view rather than the eyes. Half
 * exactly stays silent: a struggling machine drops that many frames
 * without the face being turned at all, and a diagnosis that fires on
 * ordinary jank teaches people to distrust it.
 */
export const UNMEASURED_MAJORITY_FRACTION = 0.5;

/** What the refused run saw, snapshotted by the caller before it resolved. */
export type RefusalFacts = {
  openFedFrames: number;
  openNullFrames: number;
  closedFedFrames: number;
  closedNullFrames: number;
  /** The closed phase's collected apertures, in arrival order. */
  closedApertures: readonly number[];
};

/**
 * A second sentence for a refusal, read from what the run saw — or
 * null when the record supports nothing beyond the flat sentence.
 *
 * Three shapes the roadmap names (11.6b): a view the camera rarely
 * measured (a turned or badly lit face — pose rejections, not the
 * eyes), eyes that closed late in the closed hold, and true
 * non-separation, which stays null because the flat sentence already
 * says it and a detail on top would be a guess.
 */
export function blinkRefusalDetail(
  reason: GuidedCalibrationRefusal,
  facts: RefusalFacts,
): string | null {
  if (reason === "not-enough-open" || reason === "not-enough-closed") {
    const step = reason === "not-enough-open" ? "open" : "closed";
    const fed = step === "open" ? facts.openFedFrames : facts.closedFedFrames;
    const unmeasured =
      step === "open" ? facts.openNullFrames : facts.closedNullFrames;
    if (unmeasured > fed * UNMEASURED_MAJORITY_FRACTION) {
      return `Most frames in the ${step} step carried no measured view of your eyes — that usually means a turned or poorly lit face, not the eyes themselves. Face the camera squarely, in even light, and try again.`;
    }
    return null;
  }
  if (reason === "closure-not-registered") {
    // Arrival order is the evidence: a hold where the LATER readings
    // sit far below the early ones is eyes that got there late, not
    // eyes that cannot separate. Medians per half, so one blink-sized
    // dip cannot fake a late closure.
    const half = Math.floor(facts.closedApertures.length / 2);
    const first = percentile(facts.closedApertures.slice(0, half), 50);
    const second = percentile(facts.closedApertures.slice(half), 50);
    if (first === null || second === null) {
      return null;
    }
    if (second < first * LATE_CLOSURE_DROP_FACTOR) {
      return `Your eyes look to have closed late: the closed step's later readings sit far below its early ones. Close your eyes as soon as the screen asks, and hold until it says open.`;
    }
    return null;
  }
  return null;
}
