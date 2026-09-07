import { EYES_SHUT_FRACTION } from "./longClosure";

// PERCLOS, the percentage of eye closure: what share of the recent
// past the eyes spent closed. Blink metrics count events, this
// measures a duty cycle, and it is the most validated drowsiness
// proxy in the eye tracking literature. A tired eyelid does not only
// blink differently, it sags, and sagging shows up as closed time.
//
// THIS NUMBER INCLUDES BLINK TIME. The literature's PERCLOS excludes
// blink frames and measures only the slow closures drowsiness brings;
// this one cannot, because the shut line below is the same line the
// long-closure detector uses and every full blink crosses it. So at
// rest this figure IS mostly blink time, and it inherits blink-rate
// variance along with it — a person who blinks twice as often reads
// twice as high with no change in how droopy their eyes are.
//
// Roadmap 10.10c4a, ladder B12 (audit F-029): a number that means
// something different from the number it is named after has to say so
// where it is defined, not only where it is published. Exporting a
// blink-excluded figure beside this one is a separate row.

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

// And enough samples inside that span to have summarised anything.
//
// Roadmap 10.16, ladder A27 (F-093). The span rule alone is satisfied
// by two samples fifteen seconds apart: one closed frame and one open
// frame, no observation of the fourteen seconds between them, and a
// published eyes-closed share of exactly 50 percent. That is not a
// measurement of a minute, it is a coin toss with a decimal point.
//
// 100 is deliberately far below what any session this instrument
// accepts can produce — the frame-rate gate refuses below 25 per
// second, which is 375 samples in fifteen seconds — so this cannot
// refuse an honest session; it refuses only the degenerate one. It is
// the same floor and the same reasoning as BASELINE_MIN_SAMPLES, and
// it is written into every export so a reader of a file knows which
// rule the number cleared.
export const PERCLOS_MIN_SAMPLES = 100;

// How stale the newest sample may be before the value is refused.
// A window that has stopped receiving samples is not measuring any
// more, and worse, its ratio DRIFTS on its own: no new evidence
// arrives, the older samples age out of the window one by one, and
// if the last thing seen was a closure the closed share climbs
// toward one while nobody is in the chair. Confirmed in the owner's
// own recording, where PERCLOS rose from 20.5 to 22.1 percent across
// eight seconds in which faceDetected was false throughout.
//
// Two seconds is generous enough to ride out a blink, a dropped
// frame or a moment of pose refusal, and short enough that the drift
// stays under half a percent before the value is withdrawn.
export const PERCLOS_STALE_MS = 2000;

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
  // Backwards clock: ignored, state unchanged. A sample stamped
  // before the newest one would disorder the window and silently
  // age out its neighbours. Issue #107, remediation C3.
  const newest = state.samples[state.samples.length - 1];
  if (newest !== undefined && nowMs < newest.timestampMs) {
    return state;
  }
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
  // A span that long held by two samples is not an observation of it.
  if (inWindow.length < PERCLOS_MIN_SAMPLES) {
    return null;
  }
  // Nothing recent means nothing to report. Without this the ratio
  // keeps answering, and keeps rising, long after the eyes it
  // describes have left the frame.
  if (nowMs - last.timestampMs > PERCLOS_STALE_MS) {
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
