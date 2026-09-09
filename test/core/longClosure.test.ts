import { describe, expect, it } from "vitest";

import { blinkStep, initialBlinkState } from "../../src/core/blink";
import { MAX_BLINK_DURATION_MS } from "../../src/core/constants";
import {
  EYES_SHUT_FRACTION,
  initialLongClosureState,
  LONG_CLOSURE_MAX_GAP_MS,
  LONG_CLOSURE_REARM_FRACTION,
  LONG_CLOSURE_THRESHOLD_MS,
  longClosureStep,
  longClosureThresholdMm,
  ongoingClosureMs,
  type LongClosureState,
} from "../../src/core/longClosure";

const DT_MS = 1000 / 30;
const THRESHOLD_MM = 4;
const OPEN_MM = 8;
const CLOSED_MM = 1;

// Runs a scripted aperture series from the initial state at 30 fps.
function run(
  apertures: readonly (number | null)[],
  startMs = 0,
): { state: LongClosureState; endMs: number } {
  let state = initialLongClosureState;
  let t = startMs;
  for (const apertureMm of apertures) {
    state = longClosureStep(state, t, apertureMm, THRESHOLD_MM);
    t += DT_MS;
  }
  return { state, endMs: t - DT_MS };
}

function frames(seconds: number, apertureMm: number | null): (number | null)[] {
  return Array<number | null>(Math.round(seconds * 30)).fill(apertureMm);
}

describe("the shared line", () => {
  it("is the blink maximum itself, aliased so the partition cannot drift", () => {
    expect(LONG_CLOSURE_THRESHOLD_MS).toBe(MAX_BLINK_DURATION_MS);
  });
});

describe("the shut line, roadmap amendment 5", () => {
  it("sits at the measured fraction of the personal baseline", () => {
    expect(EYES_SHUT_FRACTION).toBe(0.4);
    expect(longClosureThresholdMm(7.2)).toBeCloseTo(2.88, 12);
    expect(longClosureThresholdMm(9)).toBeCloseTo(3.6, 12);
  });

  it("replays the owner's reading droop: lids low is not eyes shut", () => {
    // The owner's measured numbers, 2026-08-05 and 2026-08-06:
    // baseline 7.2 mm, relaxed reading gaze holds the aperture in
    // the 45 to 50 percent band, scripted here at 3.4 mm (47
    // percent), fully shut eyes read 2.2 to 2.5 mm (the instrument's
    // floor, not zero). The droop value is chosen BELOW the old
    // blink line (3.6 mm at this baseline), so this exact stream
    // false-fired under the old wiring: review proved a droop above
    // the old line would pass against both wirings and kill nothing.
    // Against the shut line (2.88 mm) it must produce nothing.
    const shutLine = longClosureThresholdMm(7.2);
    let state = initialLongClosureState;
    let t = 0;
    state = longClosureStep(state, t, 5.9, shutLine);
    for (let i = 0; i < 90; i++) {
      t += DT_MS;
      state = longClosureStep(state, t, 3.4, shutLine);
    }
    expect(state.count).toBe(0);
    expect(state.eye).toBe("open");
    // Fully shut eyes at the measured floor still fire, once.
    for (let i = 0; i < 60; i++) {
      t += DT_MS;
      state = longClosureStep(state, t, 2.35, shutLine);
    }
    expect(state.count).toBe(1);
    // And reopening records the witnessed duration.
    t += DT_MS;
    state = longClosureStep(state, t, 5.9, shutLine);
    expect(state.lastLongClosureDurationMs).not.toBeNull();
  });

  it("brackets the line with measured probes, not only the constant", () => {
    // Review found that any fraction between roughly 0.33 and 0.51
    // survived the behavioral tests, pinned only by restating the
    // constant. These two probes bracket it with measurements: the
    // top of the measured shut range (2.5 mm, 34.7 percent of 7.2)
    // must close, the bottom of the measured droop band (3.3 mm,
    // 45.8 percent) must stay open.
    const shutLine = longClosureThresholdMm(7.2);
    const eyeAfter = (apertureMm: number): string => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, 5.9, shutLine);
      state = longClosureStep(state, 100, apertureMm, shutLine);
      return state.eye;
    };
    expect(eyeAfter(2.5)).toBe("closed");
    expect(eyeAfter(3.3)).toBe("open");
  });

  it("runs the aperture boundary trio at the shut line itself", () => {
    // Strictly below the line closes, exactly at it stays open, the
    // blink reducer's own convention carried over.
    const shutLine = longClosureThresholdMm(7.2);
    const eyeAfter = (apertureMm: number): string => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, 5.9, shutLine);
      state = longClosureStep(state, 100, apertureMm, shutLine);
      return state.eye;
    };
    expect(eyeAfter(shutLine - 0.001)).toBe("closed");
    expect(eyeAfter(shutLine)).toBe("open");
    expect(eyeAfter(shutLine + 0.001)).toBe("open");
  });
});

describe("longClosureStep", () => {
  it("fires while the eyes are still closed, not on reopen", () => {
    // Two seconds closed, never reopened: the count must already be 1.
    const { state } = run([...frames(1, OPEN_MM), ...frames(2, CLOSED_MM)]);
    expect(state.count).toBe(1);
    expect(state.eye).toBe("closed");
  });

  it("fires exactly once however long the closure holds", () => {
    const { state } = run([...frames(1, OPEN_MM), ...frames(6, CLOSED_MM)]);
    expect(state.count).toBe(1);
  });

  it("runs the ladder's boundary: exactly the blink maximum fires nothing, beyond fires", () => {
    // Hand stepped frames, no fps grid, so the timestamps land exactly.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    // Closed since 100. At 100 + MAX the closure is still blink sized.
    state = longClosureStep(
      state,
      100 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      THRESHOLD_MM,
    );
    expect(state.count).toBe(0);
    // One millisecond past the line it is a long closure.
    state = longClosureStep(
      state,
      101 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      THRESHOLD_MM,
    );
    expect(state.count).toBe(1);
  });

  it("never fires for ordinary blinks", () => {
    const blink = [...frames(0.15, CLOSED_MM), ...frames(1, OPEN_MM)];
    const { state } = run([
      ...frames(1, OPEN_MM),
      ...blink,
      ...blink,
      ...blink,
    ]);
    expect(state.count).toBe(0);
    expect(state.lastLongClosureDurationMs).toBeNull();
  });

  it("records the completed duration on reopen and returns to open", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 3000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 3100, OPEN_MM, THRESHOLD_MM);
    expect(state.eye).toBe("open");
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(2100);
  });

  it("counts separate long closures separately", () => {
    const { state } = run([
      ...frames(1, OPEN_MM),
      ...frames(1, CLOSED_MM),
      ...frames(1, OPEN_MM),
      ...frames(1, CLOSED_MM),
      ...frames(1, OPEN_MM),
    ]);
    expect(state.count).toBe(2);
  });

  it("a closure survives a sub-blink gap with its clock intact", () => {
    // Roadmap 10.11 re-pinned this to the physical intent: the face
    // vanishes 300 ms into a closure and returns still closed. Eyes
    // shut before a gap shorter than any complete blink and shut
    // after it did not plausibly open in between, so the clock does
    // NOT restart — the closure fires the moment its ORIGINAL span
    // crosses the line.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 400, null, THRESHOLD_MM);
    state = longClosureStep(state, 700, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
  });

  it("abandons an unwitnessed closure past the bound, gaps stay gaps", () => {
    // Past LONG_CLOSURE_MAX_GAP_MS the old rule holds in full: no
    // event may be built on frames nobody saw, AND the frames after
    // the gap may be the same droop still going, so nothing fires
    // until the eye has been seen clearly open again.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 400, null, THRESHOLD_MM);
    state = longClosureStep(
      state,
      400 + LONG_CLOSURE_MAX_GAP_MS + 1,
      CLOSED_MM,
      THRESHOLD_MM,
    );
    state = longClosureStep(state, 2000, CLOSED_MM, THRESHOLD_MM);
    // Long past any line, and still nothing: not seen open since.
    expect(state.count).toBe(0);
    state = longClosureStep(state, 2100, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 2200, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(
      state,
      2201 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      THRESHOLD_MM,
    );
    expect(state.count).toBe(1);
  });

  it("keeps a fired count but records no duration when the end goes unwitnessed", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 2000, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    state = longClosureStep(state, 2100, null, THRESHOLD_MM);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBeNull();
    expect(state.eye).toBe("unknown");
  });

  it("mirrors the blink reducer's aperture convention: exactly at threshold is open", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, THRESHOLD_MM, THRESHOLD_MM);
    expect(state.eye).toBe("open");
    state = longClosureStep(state, 100, THRESHOLD_MM - 0.001, THRESHOLD_MM);
    expect(state.eye).toBe("closed");
  });
});

describe("the reopen crossing, found by review before the pull request", () => {
  it("fires late on the reopen when the line was crossed between frames", () => {
    // The last closed frame sits at exactly the blink maximum, so no
    // closed frame ever crossed the line. The reopen measures 600 ms,
    // which blink.ts refuses. Without the late fire this witnessed
    // closure would land in neither bin.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(
      state,
      100 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      THRESHOLD_MM,
    );
    expect(state.count).toBe(0);
    state = longClosureStep(state, 700, OPEN_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(600);
    expect(state.eye).toBe("open");
  });

  it("runs the reopen boundary trio: exactly the maximum is still the blink's bin", () => {
    const reopenAt = (spanMs: number): LongClosureState => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
      state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
      return longClosureStep(state, 100 + spanMs, OPEN_MM, THRESHOLD_MM);
    };
    expect(reopenAt(LONG_CLOSURE_THRESHOLD_MS - 1).count).toBe(0);
    expect(reopenAt(LONG_CLOSURE_THRESHOLD_MS).count).toBe(0);
    expect(reopenAt(LONG_CLOSURE_THRESHOLD_MS + 1).count).toBe(1);
    expect(
      reopenAt(LONG_CLOSURE_THRESHOLD_MS + 1).lastLongClosureDurationMs,
    ).toBe(LONG_CLOSURE_THRESHOLD_MS + 1);
  });

  it("keeps the partition airtight: both reducers, one stream, one bin per closure", () => {
    // The increment's central claim, run as code: for closures of
    // many spans, fed to BOTH reducers frame for frame, exactly one
    // of the two counters claims each closure.
    for (const spanMs of [150, 400, 500, 501, 533, 600, 2000]) {
      let blink = initialBlinkState;
      let long = initialLongClosureState;
      const feed = (nowMs: number, apertureMm: number): void => {
        blink = blinkStep(blink, nowMs, apertureMm, THRESHOLD_MM);
        long = longClosureStep(long, nowMs, apertureMm, THRESHOLD_MM);
      };
      feed(0, OPEN_MM);
      // Closed frames on a 33 ms grid, strictly inside the span, then
      // the reopen lands exactly at closedAt + spanMs.
      for (let t = 100; t < 100 + spanMs; t += 33) {
        feed(t, CLOSED_MM);
      }
      feed(100 + spanMs, OPEN_MM);
      expect(blink.blinkCount + long.count).toBe(1);
    }
  });
});

describe("after the gap, re-pinned by roadmap 10.11 to the physical intent", () => {
  it("a fired closure resumed across a sub-blink gap is the same droop", () => {
    // The pre-10.11 pin here demanded a SECOND event after a 100 ms
    // lost-face flicker, which counted one droop twice — the exact
    // defect the row names. The same droop now stays one event, the
    // readout speaks again on resumption, and a genuinely new
    // closure after a real reopen still earns its own event, which
    // is what the mutation run that created this block was proving.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    state = longClosureStep(state, 1100, null, THRESHOLD_MM);
    state = longClosureStep(state, 1200, CLOSED_MM, THRESHOLD_MM);
    // Resumed, still the same fired closure: the readout speaks the
    // FULL span since the eyes closed, and nothing fires again.
    expect(ongoingClosureMs(state, 1300)).toBe(1200);
    state = longClosureStep(state, 1900, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    // A real reopen, clearly open, then a new long closure: its own
    // event, exactly as before this row.
    state = longClosureStep(state, 2000, OPEN_MM, THRESHOLD_MM);
    expect(state.lastLongClosureDurationMs).toBe(1900);
    state = longClosureStep(state, 2100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(
      state,
      2101 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      THRESHOLD_MM,
    );
    expect(state.count).toBe(2);
  });

  it("records the reopen-measured duration across a survived gap", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1100, null, THRESHOLD_MM);
    state = longClosureStep(state, 1200, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1300, OPEN_MM, THRESHOLD_MM);
    // One closure, 100 to 1300, with a witnessed hole no longer than
    // a blink: one event, and the duration spans to the reopen.
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(1200);
  });
});

describe("ongoingClosureMs, the live readout", () => {
  it("speaks only during a long closure in progress", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    expect(ongoingClosureMs(state, 0)).toBeNull();
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    // Closed but still blink sized: silent.
    expect(ongoingClosureMs(state, 200)).toBeNull();
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    // Long now: the readout is the full time since the eyes closed.
    expect(ongoingClosureMs(state, 1000)).toBe(900);
  });
});

// The gradual descent case, asked for in closed issue #126 and filed as
// issue #115. Added by the #178 reconciliation, which changes no
// behaviour: this asserts what today's code does, not what it should.
//
// For a baseline of 10 mm the blink line sits at 5.0, the arm line at
// 4.5 and the shut line at 4.0. A lid that settles at 4.3 and stays
// there is below the blink line and above the shut line, so it belongs
// to neither detector: too long to be a blink, never deep enough to be
// a long closure.
describe("a slow descent that stops between the two lines, issue #115", () => {
  const BLINK_LINE_MM = 5;
  const SHUT_LINE_MM = THRESHOLD_MM;
  const RESTING_MM = 4.3;

  /** Twelve frames of descent, two seconds held, then back open. */
  const descent: number[] = [
    ...frames(1, OPEN_MM).map((value) => value as number),
    ...Array.from(
      { length: 12 },
      (_, i) => OPEN_MM - ((OPEN_MM - RESTING_MM) * (i + 1)) / 12,
    ),
    ...(frames(2, RESTING_MM) as number[]),
    ...(frames(1, OPEN_MM) as number[]),
  ];

  it("is not a long closure, because it never reaches the shut line", () => {
    expect(RESTING_MM).toBeGreaterThan(SHUT_LINE_MM);
    expect(run(descent).state.count).toBe(0);
  });

  it("is not a blink either, because it stays down past the ceiling", () => {
    let state = initialBlinkState;
    let t = 0;
    for (const apertureMm of descent) {
      state = blinkStep(state, t, apertureMm, BLINK_LINE_MM);
      t += DT_MS;
    }
    expect(state.blinkCount).toBe(0);
  });

  it("the same descent, released before the ceiling, IS a blink", () => {
    // The boundary that makes the previous case a partition problem
    // rather than a depth problem: nothing about the shape disqualifies
    // it, only how long it was held.
    const brief: number[] = [
      ...(frames(1, OPEN_MM) as number[]),
      ...Array.from(
        { length: 12 },
        (_, i) => OPEN_MM - ((OPEN_MM - RESTING_MM) * (i + 1)) / 12,
      ),
      ...(frames(1, OPEN_MM) as number[]),
    ];
    let state = initialBlinkState;
    let t = 0;
    for (const apertureMm of brief) {
      state = blinkStep(state, t, apertureMm, BLINK_LINE_MM);
      t += DT_MS;
    }
    expect(state.blinkCount).toBe(1);
  });
});

// Roadmap 10.11. The prediction, its traces and its refuters were
// committed before the change in docs/long-closure-hysteresis.txt;
// these tests are those traces, verbatim, and the aliases that keep
// the two rules from drifting off the constants they were derived
// from.

describe("the 10.11 aliases", () => {
  it("re-arms with blink.ts's own noise-floor fraction, aliased", () => {
    expect(LONG_CLOSURE_REARM_FRACTION).toBe(0.1);
  });

  it("bounds the gap at the blink maximum, aliased", () => {
    // A gap long enough to hide a complete blink-sized reopen is
    // long enough to hide the closure's end.
    expect(LONG_CLOSURE_MAX_GAP_MS).toBe(MAX_BLINK_DURATION_MS);
  });
});

describe("the prediction's hover traces, docs/long-closure-hysteresis.txt", () => {
  const LINE_MM = 3.04;

  function trace(
    centreMm: number,
    noiseHz: number,
    rateHz: number,
    seconds: number,
  ): LongClosureState {
    let state = initialLongClosureState;
    const n = Math.round(rateHz * seconds);
    for (let i = 0; i < n; i += 1) {
      const t = i / rateHz;
      const apertureMm = centreMm + 0.3 * Math.sin(2 * Math.PI * noiseHz * t);
      state = longClosureStep(state, Math.round(t * 1000), apertureMm, LINE_MM);
    }
    return state;
  }

  it("collapses the iPhone hover shapes to one event each", () => {
    // Before this row the same traces measured 3 and 2 events — one
    // sustained droop counted several times because its noise tops
    // out at 3.2 mm, above the line but below the 3.34 mm re-arm
    // height. The prediction: one event each, at both rates.
    for (const rateHz of [30, 120]) {
      expect(trace(2.9, 0.5, rateHz, 6).count).toBe(1);
      expect(trace(2.9, 1 / 3, rateHz, 6).count).toBe(1);
    }
  });

  it("leaves the clean desktop shape untouched", () => {
    // The same noise around a centre the line never meets: one
    // closure, fired mid-closure, still in progress at the end —
    // every field exactly as the detector read it before this row.
    for (const rateHz of [30, 120]) {
      const state = trace(2.5, 0.5, rateHz, 6);
      expect(state.count).toBe(1);
      expect(state.eye).toBe("closed");
      expect(state.firedForCurrentClosure).toBe(true);
      expect(state.lastLongClosureDurationMs).toBeNull();
    }
  });

  it("counts a six-second closure with noise once, at both rates", () => {
    // The row's own phrasing of the defect, and the cadence rule:
    // duplicate ticks carry the same aperture, so 30 and 120 Hz must
    // agree or the change smuggled in a clock dependence.
    const counts = [30, 120].map((rateHz) => trace(2.9, 0.5, rateHz, 6).count);
    expect(counts[0]).toBe(counts[1]);
  });
});

describe("the re-arm gate, roadmap 10.11", () => {
  it("does not fire again until the eye is seen clearly open", () => {
    // A reopen to just above the line — inside the noise band — is
    // not evidence the droop ended. The next crossing arms nothing.
    const justAboveMm = THRESHOLD_MM * 1.05;
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    state = longClosureStep(state, 1100, justAboveMm, THRESHOLD_MM);
    state = longClosureStep(state, 1200, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 2500, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
  });

  it("re-arms the moment the line is cleared by the fraction", () => {
    const clearlyOpenMm = THRESHOLD_MM * (1 + LONG_CLOSURE_REARM_FRACTION);
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1100, clearlyOpenMm, THRESHOLD_MM);
    state = longClosureStep(state, 1200, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1801, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(2);
  });

  it("endings are untouched: the duration is the same span as before", () => {
    // Hysteresis on the ARMING side only. A closure still ends the
    // frame the aperture reaches the line, so the recorded span is
    // what it always was.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 3000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 3100, THRESHOLD_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(2100);
  });

  it("runs the boundary trio on the gap bound", () => {
    const build = (gapMs: number): LongClosureState => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
      state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
      state = longClosureStep(state, 400, null, THRESHOLD_MM);
      return longClosureStep(state, 400 + gapMs, CLOSED_MM, THRESHOLD_MM);
    };
    // At and below the bound the closure survives with its clock:
    // 100 to 400+gap is already past the line, so it fires at once.
    expect(build(LONG_CLOSURE_MAX_GAP_MS - 1).count).toBe(1);
    expect(build(LONG_CLOSURE_MAX_GAP_MS).count).toBe(1);
    // Past it the cycle is abandoned and the gate is shut.
    expect(build(LONG_CLOSURE_MAX_GAP_MS + 1).count).toBe(0);
  });
});
