import { MAX_BLINK_DURATION_MS } from "./constants";
import { LONG_CLOSURE_MAX_GAP_MS } from "./longClosure";
import {
  PERCLOS_MIN_OBSERVED_MS,
  PERCLOS_MIN_SAMPLES,
  PERCLOS_STALE_MS,
  PERCLOS_WINDOW_MS,
  type PerclosState,
} from "./perclos";

// Roadmap 12.10a, ladder C7. The literature's PERCLOS is the share of a
// minute the eyelids spend at least 80 percent closed, counting SLOW
// closures only: blinks are left out, because what it watches for is
// eyes staying shut, not eyes flicking. This instrument's perclos
// cannot leave them out — its shut line is the one every full blink
// crosses (perclos.ts says so where it is defined) — so at rest it is
// mostly blink time and inherits the blink rate's variance.
//
// This is the second column beside it: the same share with every
// closure at or below the blink maximum left out. Two things are still
// NOT the literature's and the column's header says so: the line is the
// instrument's own 40 percent of baseline, not P80's 20 (a shut eye
// reads about a third of baseline here, so 20 percent is unreachable),
// and "blink" means blink.ts's own time partition, not an external
// one. The score keeps the current perclos until 12.18 reads.
//
// ONE FEED, TWO READS. This does not keep a sample buffer of its own:
// it reads perclos's, with a different reduction. The two columns
// therefore cannot be fed different frames, and every floor perclos
// refuses on — the window, the observed span, the sample count, the
// staleness — is applied here in the same order, so the two are null
// together and the blink-excluded share can never exceed perclos.
//
// A CLOSURE is a run of consecutive closed samples. Its span runs from
// its first closed sample to the sample that reopens it, the span
// blink.ts and longClosure.ts both measure; at or below the blink
// maximum it is a blink and is left out, strictly beyond it it counts,
// the project's one edge convention. An untrusted gap inside a run is
// bridged up to longClosure.ts's own bound — eyes shut either side of
// a sub-blink gap did not plausibly open in between — and past it the
// run is split and each side judged on what was witnessed, which can
// only understate a closure. So can the window's trailing edge: a
// closure that began before the window is judged by its in-window
// span. Both errors lean toward leaving out, never toward inflating.

/**
 * The blink-excluded eyes-closed share of the window, or null exactly
 * when perclosValue would be.
 */
export function blinkExcludedPerclosValue(
  state: PerclosState,
  nowMs: number,
): number | null {
  const inWindow = state.samples.filter(
    (sample) => nowMs - sample.timestampMs <= PERCLOS_WINDOW_MS,
  );
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  if (last.timestampMs - first.timestampMs < PERCLOS_MIN_OBSERVED_MS) {
    return null;
  }
  if (inWindow.length < PERCLOS_MIN_SAMPLES) {
    return null;
  }
  if (nowMs - last.timestampMs > PERCLOS_STALE_MS) {
    return null;
  }
  let slowClosedCount = 0;
  let index = 0;
  while (index < inWindow.length) {
    const start = inWindow[index];
    if (start === undefined || !start.closed) {
      index += 1;
      continue;
    }
    // Extend the run over closed samples whose gaps stay within bound.
    let end = start;
    let runLength = 1;
    let next = inWindow[index + runLength];
    while (
      next !== undefined &&
      next.closed &&
      next.timestampMs - end.timestampMs <= LONG_CLOSURE_MAX_GAP_MS
    ) {
      end = next;
      runLength += 1;
      next = inWindow[index + runLength];
    }
    // The reopen closes the span when it is witnessed within the bound;
    // otherwise the run's end was not seen and only its closed samples
    // measure it.
    const endMs =
      next !== undefined &&
      next.timestampMs - end.timestampMs <= LONG_CLOSURE_MAX_GAP_MS
        ? next.timestampMs
        : end.timestampMs;
    if (endMs - start.timestampMs > MAX_BLINK_DURATION_MS) {
      slowClosedCount += runLength;
    }
    index += runLength;
  }
  return slowClosedCount / inWindow.length;
}
