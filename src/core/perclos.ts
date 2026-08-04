// PERCLOS, the percentage of eye closure: what share of the recent
// past the eyes spent closed. Blink metrics count events, this
// measures a duty cycle, and it is the most validated drowsiness
// proxy in the eye tracking literature. A tired eyelid does not only
// blink differently, it sags, and sagging shows up as closed time.

export const PERCLOS_WINDOW_MS = 60000;

// The classic P80 convention: an eye at or below 20 percent of its
// own open baseline counts as closed. Exactly at the line counts,
// the house boundary rule. Relative to the PERSONAL baseline from
// 4.2, because absolute apertures differ between faces.
export const PERCLOS_CLOSED_FRACTION = 0.2;

// The 4.4 observed-time discipline: no number until the window holds
// enough reality to summarize. Fifteen seconds of valid span.
export const PERCLOS_MIN_OBSERVED_MS = 15000;

type ClosureSample = {
  timestampMs: number;
  closed: boolean;
};

export type PerclosState = {
  samples: readonly ClosureSample[];
};

export function emptyPerclos(): PerclosState {
  return { samples: [] };
}

// Classification happens here, at push time, against the baseline of
// this moment: a baseline that ratchets up later never rewrites
// history. An untrusted frame (no aperture, or no baseline yet)
// joins neither side of the ratio, gaps stay gaps.
export function perclosStep(
  state: PerclosState,
  nowMs: number,
  apertureMm: number | null,
  baselineMm: number | null,
): PerclosState {
  const kept = state.samples.filter(
    (sample) => nowMs - sample.timestampMs <= PERCLOS_WINDOW_MS,
  );
  if (apertureMm === null || baselineMm === null) {
    return { samples: kept };
  }
  const closed = apertureMm <= PERCLOS_CLOSED_FRACTION * baselineMm;
  return { samples: [...kept, { timestampMs: nowMs, closed }] };
}

// The closed share of valid samples in the window. Sample weighted,
// which equals time weighted at a steady frame rate; the fps gate
// upstream already refuses the unsteady case for blink metrics and
// the same aperture feed serves here.
export function perclosValue(
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
  let closedCount = 0;
  for (const sample of inWindow) {
    if (sample.closed) {
      closedCount++;
    }
  }
  return closedCount / inWindow.length;
}
