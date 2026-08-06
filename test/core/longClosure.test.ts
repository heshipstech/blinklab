import { describe, expect, it } from "vitest";

import { blinkStep, initialBlinkState } from "../../src/core/blink";
import { MAX_BLINK_DURATION_MS } from "../../src/core/constants";
import {
  EYES_SHUT_FRACTION,
  initialLongClosureState,
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

  it("abandons an unwitnessed closure, gaps stay gaps", () => {
    // The face vanishes 300 ms into a closure, well before the line.
    // When it returns still closed, the clock restarts: no event may
    // be built on frames nobody saw.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 400, null, THRESHOLD_MM);
    state = longClosureStep(state, 700, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1100, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(0);
    // The fresh closure's clock started at 700, so the line falls at
    // 700 + the threshold, not sooner.
    state = longClosureStep(
      state,
      701 + LONG_CLOSURE_THRESHOLD_MS,
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

describe("after the gap, found by mutation testing before the pull request", () => {
  it("counts a second long closure after a gap ended the first", () => {
    // A fired closure interrupted by a lost face must not poison the
    // next cycle: the fresh closure earns its own event.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    state = longClosureStep(state, 1100, null, THRESHOLD_MM);
    state = longClosureStep(state, 1200, CLOSED_MM, THRESHOLD_MM);
    // Still blink sized after the gap: the readout must stay silent
    // and nothing may fire yet.
    expect(ongoingClosureMs(state, 1300)).toBeNull();
    expect(state.count).toBe(1);
    state = longClosureStep(state, 1900, CLOSED_MM, THRESHOLD_MM);
    expect(state.count).toBe(2);
  });

  it("records no duration for a blink sized closure after a gap", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, THRESHOLD_MM);
    state = longClosureStep(state, 100, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1000, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1100, null, THRESHOLD_MM);
    // A quick witnessed blink after the gap: count and duration must
    // both stay exactly as the gap left them.
    state = longClosureStep(state, 1200, CLOSED_MM, THRESHOLD_MM);
    state = longClosureStep(state, 1300, OPEN_MM, THRESHOLD_MM);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBeNull();
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
