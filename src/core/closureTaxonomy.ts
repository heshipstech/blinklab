import { LONG_CLOSURE_THRESHOLD_MS } from "./longClosure";

// Roadmap 12.6. A closure that outstays a blink is currently one
// thing. `longClosureCount` charges the same fifteen points whether
// the eyes were shut for six hundred milliseconds or six minutes, and
// the export carries the same column for both. Those are not the same
// event, and a reader given only the count cannot tell them apart.
//
// So the durations get bands, and the bands get names. Three of them:
// prolonged, microsleep-range, sustained.
//
// THE NAMING IS HALF THE ROW. The middle band is "microsleep-RANGE"
// and never "microsleep", because a microsleep is defined on the
// electroencephalogram and no data this project may use, now or in
// this era, could validate one. Roadmap amendment 16 capped the
// vocabulary at the range; what this instrument can honestly say is
// that a closure lasted as long as the ones that literature describes,
// which is a statement about a stopwatch and not about a brain. The
// cap is held by a test over the labels below and by claimGuard over
// every tracked file, so it survives whoever writes the next panel.
//
// THE EDGES ARE CHOICES and are stated as choices rather than dressed
// as derivations, the same discipline blinkRhythm.ts's floor is under.
// Nothing was measured to place them, because placing them by
// measurement would need closures with known causes, which is exactly
// the ground truth the vocabulary cap exists because this project
// does not have.
//
// Nothing here is wired to the page or the export. Row 12.6 is the
// taxonomy and its edges; which surface says these words, and whether
// the export carries a per-closure class, are later rows. Building
// the consumer ahead of the row that asks for one would be guessing
// at what it wants, which is the reason 12.9 shipped without one too.

/**
 * Where a closure stops being prolonged and enters the microsleep
 * range, in milliseconds.
 *
 * Two seconds is four times the blink maximum. Below it a closure is
 * still explicable as ordinary machinery — a slow blink, a wince, a
 * squint, a blink the frame grid split — and the honest word is that
 * the lid stayed down longer than a blink does. Above it the eye was
 * shut for a span nothing ordinary accounts for.
 *
 * The band this opens is named for a RANGE OF DURATIONS and not for
 * a state of the brain. See the header.
 */
export const MICROSLEEP_RANGE_MIN_MS = 2000;

/**
 * Where a closure stops being in the microsleep range and becomes
 * simply sustained, in milliseconds.
 *
 * Fifteen seconds is thirty times the blink maximum. Past it the
 * useful fact is the duration itself rather than which band it fell
 * in: a closure this long is an eye that is shut, and the causes that
 * fit it — asleep, looking down for a long moment, a camera left
 * running at an empty chair — are not distinguished by any number
 * this instrument produces. The band exists so that those are not
 * reported in the same words as a three-second closure, not because
 * fifteen seconds is a boundary in nature.
 */
export const SUSTAINED_CLOSURE_MIN_MS = 15000;

/** The three bands a closure past the blink maximum can fall in. */
export type ClosureClass = "prolonged" | "microsleep-range" | "sustained";

/**
 * What each band may be called, anywhere a person can read it.
 *
 * These are the words, and they are here rather than at each surface
 * so that there is one set of them to hold to the vocabulary cap. A
 * test asserts that none of them says "microsleep" without "-range"
 * after it, and none pairs the word with detection.
 */
export const CLOSURE_CLASS_LABELS: Record<ClosureClass, string> = {
  prolonged: "prolonged closure",
  "microsleep-range": "microsleep-range closure",
  sustained: "sustained closure",
};

/**
 * Which band a closed span falls in, or null when it is short enough
 * to be a blink.
 *
 * Null is the answer for anything at or below the long-closure line,
 * because blink.ts has already counted it. The line is imported
 * rather than repeated: for any one aperture line every closure lands
 * in exactly one time category, and a private copy of 500 here could
 * drift and leave a closure in two categories or in none.
 *
 * Throws on a duration that is not one. A negative or non-finite span
 * is a defect in whatever produced it, and returning null would let
 * it pass quietly as a blink.
 */
export function classifyClosure(durationMs: number): ClosureClass | null {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(
      `closure duration must be a finite number of milliseconds and not ` +
        `negative, got ${durationMs}`,
    );
  }
  if (durationMs <= LONG_CLOSURE_THRESHOLD_MS) {
    return null;
  }
  // At each edge the LOWER band wins, which is the convention
  // longClosure.ts already sets: at the line a closure is still a
  // blink and only strictly beyond it is long. One rule for every
  // band edge in the project means a reader has to learn it once.
  if (durationMs <= MICROSLEEP_RANGE_MIN_MS) {
    return "prolonged";
  }
  if (durationMs <= SUSTAINED_CLOSURE_MIN_MS) {
    return "microsleep-range";
  }
  return "sustained";
}
