import { BLINK_APERTURE_THRESHOLD_MM } from "./constants";
import type { StoredBlinkCalibration } from "./guidedCalibration";
import { longClosureThresholdMm } from "./longClosure";

// Where the line came from. Roadmap 10.13a, ladder A8, audit F-007 and
// G-Guided b-11. The prediction about what these columns must not
// change lives in docs/line-in-the-export.txt and was committed first.
//
// A blink is counted when the aperture crosses a line, and the
// duration, the amplitude and the peak velocity are all measured from
// that crossing. Three different lines can be in force — the passive
// baseline's half, a stored guided line the person measured on
// themselves, and a fixed fallback constant — and on one face they
// differ by millimetres. Until this module, no export said which.
//
// Two exports of one session could therefore disagree about every
// blink number while agreeing about every column that explains them,
// and plot.py redrew a threshold the detector had not used.
//
// This module DECIDES nothing. The wiring already picks the line; this
// reports the pick, which is why each function reads as "what was the
// reducer handed" rather than "what should the line be". A second
// opinion about the line would be a second line.

/**
 * The provenance vocabulary, in order of how much the instrument
 * vouches for the line.
 *
 * `none` is a frame with no line at all, and it is not the same as a
 * missing value: it is the measured fact that nothing was compared.
 * `fixed` is the fallback constant. `passive` is half the learned
 * baseline. `guided` is the person's own measured midpoint.
 */
export const LINE_SOURCES = ["none", "fixed", "passive", "guided"] as const;

export type LineSource = (typeof LINE_SOURCES)[number];

/** A line and where it came from, as one indivisible pair. */
export type ResolvedLine = {
  mm: number | null;
  source: LineSource;
};

const NO_LINE: ResolvedLine = { mm: null, source: "none" };

/**
 * The blink line this frame, and its provenance.
 *
 * The stored guided line wins wherever it exists, including over a
 * refusal: it is a complete ruler measured from the person's own open
 * and closed aperture, so it needs no passive baseline and the
 * refusal that withholds the passive one does not touch it.
 *
 * A refused passive session carries NO line rather than its
 * baseline's half. Printing the half would invite a reader to check
 * the withheld blink numbers against it, which is the one thing the
 * refusal exists to prevent.
 *
 * `usedFallback` says the wiring handed the reducer
 * BLINK_APERTURE_THRESHOLD_MM because it held no line of its own. It
 * is reported rather than assumed away: the prediction document
 * argues that case is unreachable on a corpus clip, and a column that
 * could not express it would record a real fallback as `passive` and
 * hide exactly the defect worth finding.
 */
export function resolveBlinkLine(
  stored: StoredBlinkCalibration | null,
  baselineLineMm: number | null,
  calibrationRefused: boolean,
  usedFallback = false,
): ResolvedLine {
  if (stored !== null) {
    return { mm: stored.personalLineMm, source: "guided" };
  }
  if (calibrationRefused) {
    return NO_LINE;
  }
  if (baselineLineMm !== null) {
    return { mm: baselineLineMm, source: "passive" };
  }
  return usedFallback
    ? { mm: BLINK_APERTURE_THRESHOLD_MM, source: "fixed" }
    : NO_LINE;
}

/**
 * The shut line this frame, and its provenance.
 *
 * Computed through `longClosureThresholdMm`, the function the
 * long-closure detector itself calls, rather than by restating the
 * fraction. A changed fraction has to move this column too, or the
 * column would faithfully describe a line nobody reads.
 *
 * Two sources only. Whether a guided line should also serve the shut
 * baseline is an open question the ladder holds as an ADR, and wiring
 * it here would answer that question by default rather than by
 * argument.
 */
export function resolveShutLine(
  frozenShutBaselineMm: number | null,
): ResolvedLine {
  return frozenShutBaselineMm === null
    ? NO_LINE
    : { mm: longClosureThresholdMm(frozenShutBaselineMm), source: "passive" };
}

/**
 * Whether this frame's blink numbers are withheld.
 *
 * One decision, in one place, for the four things that used to make it
 * separately: the readout, the record, the report and the log button.
 * They could disagree, and a session whose readout withheld while its
 * export did not is a session that published numbers it had said it
 * could not vouch for.
 *
 * A withheld frame is exactly a frame with no line, which
 * `resolveBlinkLine` above must agree with and a test holds it to.
 */
export function blinksWithheld(
  calibrationRefused: boolean,
  hasGuidedLine: boolean,
): boolean {
  return calibrationRefused && !hasGuidedLine;
}
