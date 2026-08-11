import { describe, expect, it } from "vitest";

import { baselineStep, startBaseline } from "../../src/core/baseline";
import { blinkStep, initialBlinkState } from "../../src/core/blink";
import { recordBlink, startRate } from "../../src/core/blinkRate";
import {
  initialLongClosureState,
  longClosureStep,
  ongoingClosureMs,
} from "../../src/core/longClosure";
import { emptyPerclos, perclosStep } from "../../src/core/perclos";

// Issue #107, remediation C3. The real wiring refuses a backwards
// timestamp at the door (frameClock's acceptFrame), so these guards
// are the pure reducers keeping their own contract: a frame stamped
// earlier than the newest timestamp the STATE CARRIES is ignored,
// state unchanged. Before them, a reopen stamped earlier than the
// close recorded a negative blink or closure duration. The guards
// are exactly that strong and no stronger: an open state carries no
// timestamp, so disorder among open frames is the door's job, and
// the boundary is strict, an EQUAL stamp is processed, matching the
// exactly-at conventions elsewhere. Every test drives real forward
// steps first, so the backwards frame lands on a mid-flight state.

const THRESHOLD = 4;

describe("blink ignores a backwards clock", () => {
  it("a reopen stamped before the close cannot record a negative duration", () => {
    let state = blinkStep(initialBlinkState, 1000, 8, THRESHOLD);
    state = blinkStep(state, 1100, 2, THRESHOLD); // closes, arms
    const closed = state;
    // Reopen stamped 400 ms BEFORE the close. Ignored outright.
    state = blinkStep(state, 700, 8, THRESHOLD);
    expect(state).toEqual(closed);
    // The same reopen at an honest later time still counts normally.
    state = blinkStep(state, 1300, 8, THRESHOLD);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(200);
  });

  it("a frame stamped before the last counted blink is ignored", () => {
    let state = blinkStep(initialBlinkState, 1000, 8, THRESHOLD);
    state = blinkStep(state, 1100, 2, THRESHOLD);
    state = blinkStep(state, 1300, 8, THRESHOLD);
    const counted = state;
    expect(state).toEqual(blinkStep(state, 900, 2, THRESHOLD));
    expect(counted.blinkCount).toBe(1);
  });
});

describe("long closure ignores a backwards clock", () => {
  it("a reopen stamped before the close cannot measure a negative closure", () => {
    let state = longClosureStep(initialLongClosureState, 1000, 2, 3);
    const closed = state;
    expect(longClosureStep(state, 400, 8, 3)).toEqual(closed);
    // Honest reopen still ends the closure with a positive duration.
    state = longClosureStep(state, 1700, 8, 3);
    expect(state.lastLongClosureDurationMs).toBe(700);
  });
});

describe("baseline ignores a backwards clock", () => {
  it("a sample stamped before learning began cannot stretch the window", () => {
    let state = startBaseline(1000);
    state = baselineStep(state, 1100, 7);
    const learning = state;
    expect(baselineStep(state, 500, 7)).toEqual(learning);
  });
});

describe("blink rate ignores a backwards clock", () => {
  it("a blink recorded before the newest one is ignored", () => {
    let state = startRate(1000);
    state = recordBlink(state, 2000);
    const recorded = state;
    expect(recordBlink(state, 1500)).toEqual(recorded);
    expect(recordBlink(state, 500)).toEqual(recorded);
  });
});

describe("PERCLOS ignores a backwards clock", () => {
  it("a sample stamped before the newest one cannot disorder the window", () => {
    let state = emptyPerclos();
    state = perclosStep(state, 1000, 7, 8);
    state = perclosStep(state, 2000, 7, 8);
    const windowed = state;
    expect(perclosStep(state, 1500, 1, 8)).toEqual(windowed);
    // The boundary is strict: an EQUAL stamp is processed, not
    // refused, pinning the guard at exactly backwards.
    expect(perclosStep(state, 2000, 1, 8).samples.length).toBe(3);
  });
});

describe("an ongoing closure never reads negative", () => {
  it("a read clock behind the closure start answers null", () => {
    // Issue #107 named this function. "0 ms and counting" would be
    // a wrong answer wearing a clamp; null is the honest one.
    let state = longClosureStep(initialLongClosureState, 1000, 2, 3);
    for (let t = 1100; t <= 1600; t += 100) {
      state = longClosureStep(state, t, 2, 3);
    }
    expect(ongoingClosureMs(state, 1700)).toBe(700);
    expect(ongoingClosureMs(state, 400)).toBeNull();
  });
});
