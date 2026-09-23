import { APERTURE_HYSTERESIS_FRACTION } from "./constants";

// Roadmap 12.6b, remediation C11. The closure taxonomy (12.6) names a
// closure by how LONG it lasted; this names a blink by how FAR the lid
// travelled, and the two are independent: a quick blink can stop half
// way down, and a slow one can close all the way.
//
// closureFraction is the blink's amplitude over the frozen open
// baseline: the share of this person's measured open eye the lid
// covered on its way down. It is the relative ruler the blink table's
// absolute one never was. That table greys any blink under 1.5 mm of
// amplitude (FAINT_BLINK_MM in blinkLog.ts), and 1.5 mm is a different
// ruler on every face — a fifth of an 8 mm eye, a third of a 4.5 mm
// one — while a share of the person's own baseline reads alike on
// every face that baseline was measured well on.
//
// THE LABEL SITS AT THE ARM LINE, the detector's own depth rule, and
// not at a number chosen here. Since fix #114 a closure arms as a
// blink only once the aperture reaches the blink line less the
// hysteresis gap (blink.ts), and docs/miss-character.txt found the
// detector's misses defined by exactly that depth: the never_armed
// closures bottomed between 0.91 and 0.996 of the line. On the
// closure-fraction scale the arm line sits at 1 - armLine / baseline,
// how far a lid falling from the frozen baseline must travel to reach
// it, and a blink that travelled at least that far is complete.
//
// THE LABEL READS TRAVEL WHERE THE DETECTOR READS DEPTH. The two agree
// whenever the lid starts its fall from the baseline. A lid that
// starts lower — a blink before the last one fully reopened, a lid
// already drooping — can reach the arm line, be counted, and still
// read incomplete, because it covered less of the open eye than the
// arm line asks of it. That gap is why the Check's first clause (the
// arm line and the label agree on every fixture blink) is a check and
// not a tautology, and the owner's second recorded blink shows its
// size: counted a millimetre past the arm line, labelled complete by
// two hundredths of the baseline (test/core/closureCompleteness.test.ts).
//
// ONLY AS GOOD AS THE FROZEN BASELINE. Both numbers divide by it, so a
// ruler born wrong moves them together: a baseline born high reads
// every blink's travel short, the failure docs/validation-dry-run.txt
// records on its macbookair session (born at 1.41 times resting).
// Whether the ruler can be trusted is baselineOverResting's question
// (rulerFit.ts), asked beside this one rather than inside it.
//
// EXPORT AND PANEL ONLY, and nothing here is wired yet: the blink-log
// column and the table's label are the row's later slices. The Check's
// second clause, the committed miss table's min_ratio distribution
// reproduced from the new column, needs per-frame traces this
// repository deliberately does not keep, and stays the owner's.

/** Whether a blink's lid travel reached the detector's arm line. */
export type ClosureCompleteness = "complete" | "incomplete";

/**
 * The blink's amplitude as a fraction of the frozen open baseline.
 *
 * Null (never a number) when the blink's shape could not be analysed
 * or when there is no ruler to divide by: no baseline yet, a refused
 * one, or one that is not positive. Null is the answer and not zero:
 * a blink whose shape could not be read did not travel zero
 * millimetres, the null-never-zero rule the whole export keeps.
 */
export function closureFraction(
  amplitudeMm: number | null,
  baselineMm: number | null,
): number | null {
  if (amplitudeMm === null || baselineMm === null || baselineMm <= 0) {
    return null;
  }
  return amplitudeMm / baselineMm;
}

/**
 * Where the detector's arm line sits on the closure-fraction scale:
 * the share of the frozen baseline a lid falling from it must cover to
 * reach the blink line less the hysteresis gap, the depth blink.ts
 * arms at. The same expression as blink.ts's, restated rather than
 * imported because the detector keeps it inline; the agreement tests
 * run the real blinkStep, so the two cannot drift apart unnoticed.
 */
export function armLineClosureFraction(
  blinkLineMm: number,
  baselineMm: number,
): number {
  return 1 - (blinkLineMm * (1 - APERTURE_HYSTERESIS_FRACTION)) / baselineMm;
}

/**
 * The complete/incomplete label at the arm line, or null when there is
 * no fraction to label or no line to place the cut at.
 *
 * `blinkLineMm` is the line the detector compared against when it
 * counted the blink — the guided line or the passive one — because
 * the arm line hangs from whichever was in force.
 */
export function closureCompleteness(
  fraction: number | null,
  blinkLineMm: number | null,
  baselineMm: number | null,
): ClosureCompleteness | null {
  if (
    fraction === null ||
    blinkLineMm === null ||
    baselineMm === null ||
    baselineMm <= 0
  ) {
    return null;
  }
  // Exactly at the arm line is complete: the house boundary rule the
  // detector arms by ("exactly at the arm line still arms", blink.ts).
  return fraction >= armLineClosureFraction(blinkLineMm, baselineMm)
    ? "complete"
    : "incomplete";
}
