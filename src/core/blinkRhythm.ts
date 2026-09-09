import { coefficientOfVariation } from "./statistics";

// Roadmap 12.9. How REGULARLY somebody blinks, as distinct from how
// often.
//
// Blink rate cannot tell two people apart when one blinks
// metronomically and the other goes quiet and then flurries. Both
// report fifteen a minute. The literature ties raggedness of blink
// timing to fatigue and to task load, and this project has no meter
// for it, so here is the plainest one: the spread of the gaps between
// blinks over their mean.
//
// A RATIO rather than a spread in milliseconds, and that choice is
// the whole design. A standard deviation of 200 ms means something
// different to somebody blinking every second and somebody blinking
// every ten, so a raw spread would be measuring blink rate a second
// time under another name. The ratio is scale-free by construction:
// stretch every timestamp by the same factor and it does not move,
// which is pinned by a test rather than asserted here.
//
// Nothing in this module is wired to the page or the export. Row 12.9
// is the measurement and its properties; a consumer is a later row,
// and building the export ahead of one would be guessing at what it
// wants.

/**
 * How many blinks before the irregularity is reported at all.
 *
 * Fifteen blinks is fourteen gaps. This is a CHOICE and is stated as
 * one rather than dressed up as a derivation: a coefficient of
 * variation from a handful of intervals is dominated by which
 * particular blinks happened to land in the window, and a number that
 * unstable published beside stable ones invites a comparison it
 * cannot carry. Fourteen gaps is the point at which one unusual gap
 * stops being able to double the answer on its own.
 *
 * At an ordinary fifteen blinks a minute this is about a minute of
 * watching, which is the same order as the PERCLOS window, so a
 * session short enough to refuse one refuses both.
 */
export const MIN_BLINKS_FOR_RHYTHM = 15;

/**
 * The gaps between consecutive blink onsets, in milliseconds.
 *
 * Onset to onset, which is the convention the literature uses and the
 * only one that does not mix a duration into an interval.
 *
 * Refuses times that do not move forward. A blink log whose times go
 * backwards, or repeat, is a defect upstream rather than a person who
 * blinked twice at one instant, and a negative gap would quietly
 * shrink the mean and inflate the ratio — a wrong number that looks
 * entirely ordinary.
 */
export function interBlinkIntervalsMs(onsetsMs: readonly number[]): number[] {
  const gaps: number[] = [];
  let previous: number | null = null;
  for (const onset of onsetsMs) {
    if (previous !== null) {
      if (!(onset > previous)) {
        throw new Error(
          `blink onsets must move forward: ${previous} then ${onset}. A ` +
            "backwards or repeated time is a defect in the log, not a " +
            "person blinking twice at one instant",
        );
      }
      gaps.push(onset - previous);
    }
    previous = onset;
  }
  return gaps;
}

/**
 * The coefficient of variation of the gaps between blinks, or null
 * when there are too few blinks to say.
 *
 * Null is a refusal and never a zero: zero is what a metronome
 * scores, and a session with three blinks in it has not been measured
 * as regular.
 *
 * The ratio itself comes from `statistics.ts` rather than being
 * computed here, so the one place this repository defines a
 * coefficient of variation stays the one place.
 */
export function intervalIrregularity(
  onsetsMs: readonly number[],
): number | null {
  if (onsetsMs.length < MIN_BLINKS_FOR_RHYTHM) {
    return null;
  }
  return coefficientOfVariation(interBlinkIntervalsMs(onsetsMs));
}
