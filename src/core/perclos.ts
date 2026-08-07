import { EYES_SHUT_FRACTION } from "./longClosure";

// PERCLOS, the percentage of eye closure: what share of the recent
// past the eyes spent closed. Blink metrics count events, this
// measures a duty cycle, and it is the most validated drowsiness
// proxy in the eye tracking literature. A tired eyelid does not only
// blink differently, it sags, and sagging shows up as closed time.

export const PERCLOS_WINDOW_MS = 60000;

// The closed line, amendment 6. This began as the literature's P80
// convention, 20 percent of baseline, and measurement killed it: the
// instrument reads fully shut eyes as about a third of baseline
// (never near zero, the model stops short of a zero aperture), so
// the 20 percent line was unreachable and PERCLOS read 0.0 percent
// through a witnessed 12.9 second closure. The line is now the same
// measured shut line the long closure detector uses, aliased so the
// two watchers of "shut" can never drift apart. This is an
// INSTRUMENT-ADJUSTED convention, no longer literal P80, and the
// docs say so plainly. Boundary: strictly below the line closes,
// exactly at it stays open, the SAME convention as the blink and
// long closure reducers, aligned by review so the two watchers of
// the shared line agree at the line itself. Relative to the
// PERSONAL baseline from 4.2, and in the wiring both shut-line
// consumers receive the same frozen first-ready baseline, so their
// millimetre lines are identical for a whole session.
export const PERCLOS_CLOSED_FRACTION = EYES_SHUT_FRACTION;

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
  const closed = apertureMm < PERCLOS_CLOSED_FRACTION * baselineMm;
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
