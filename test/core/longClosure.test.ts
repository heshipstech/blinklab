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
// The default geometry, a 10 mm baseline: blink line 5, shut line 4.
// CLOSED_MM crosses both lines on the same frame, so every scenario
// that always plunged straight to the floor keeps its old timings.
const BLINK_LINE_MM = 5;
const SHUT_LINE_MM = 4;
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
    state = longClosureStep(state, t, apertureMm, BLINK_LINE_MM, SHUT_LINE_MM);
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
  // The owner's measured numbers, 2026-08-05 and 2026-08-06: baseline
  // 7.2 mm, so the blink line sits at 3.6 and the shut line at 2.88.
  const OWNER_BLINK_LINE = 3.6;
  const OWNER_SHUT_LINE = longClosureThresholdMm(7.2);

  it("sits at the measured fraction of the personal baseline", () => {
    expect(EYES_SHUT_FRACTION).toBe(0.4);
    expect(longClosureThresholdMm(7.2)).toBeCloseTo(2.88, 12);
    expect(longClosureThresholdMm(9)).toBeCloseTo(3.6, 12);
  });

  it("replays the owner's reading droop: lids low is not eyes shut", () => {
    // Relaxed reading gaze holds the aperture at 3.4 mm (47 percent),
    // below the blink line: since issue #115 that opens an EPISODE and
    // its clock runs, but the episode never reaches the shut line, so
    // it still counts nothing however long it holds. Fully shut eyes
    // at the measured floor (2.35 mm) qualify it, once — and the
    // recorded duration now spans the whole episode, droop included,
    // which is the redesign's very claim.
    let state = initialLongClosureState;
    let t = 0;
    state = longClosureStep(state, t, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    for (let i = 0; i < 90; i++) {
      t += DT_MS;
      state = longClosureStep(state, t, 3.4, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    }
    expect(state.count).toBe(0);
    for (let i = 0; i < 60; i++) {
      t += DT_MS;
      state = longClosureStep(
        state,
        t,
        2.35,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
    }
    expect(state.count).toBe(1);
    t += DT_MS;
    state = longClosureStep(state, t, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    expect(state.lastLongClosureDurationMs).not.toBeNull();
    // Three seconds of droop plus two of shut: the span includes both.
    expect(state.lastLongClosureDurationMs ?? 0).toBeGreaterThan(3000);
  });

  it("brackets the qualification with measured probes, not only the constant", () => {
    // Review of amendment 5 found that any fraction between roughly
    // 0.33 and 0.51 survived tests that only restated the constant.
    // These probes bracket it with measurements: the top of the
    // measured shut range (2.5 mm, 34.7 percent of 7.2) must qualify
    // an episode, the bottom of the measured droop band (3.3 mm, 45.8
    // percent) must not, however long it holds.
    const countAfterHolding = (apertureMm: number): number => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
      state = longClosureStep(
        state,
        100,
        apertureMm,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      state = longClosureStep(
        state,
        2100,
        apertureMm,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      return state.count;
    };
    expect(countAfterHolding(2.5)).toBe(1);
    expect(countAfterHolding(3.3)).toBe(0);
  });

  it("runs the qualification boundary trio at the shut line itself", () => {
    // Strictly below the shut line qualifies, exactly at it does not,
    // the blink reducer's own boundary convention carried to the
    // depth test. One probe frame inside a long band episode decides.
    const countAfterProbe = (probeMm: number): number => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
      state = longClosureStep(
        state,
        100,
        3.0,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      state = longClosureStep(
        state,
        600,
        3.0,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      state = longClosureStep(
        state,
        700,
        probeMm,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      state = longClosureStep(
        state,
        800,
        3.0,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      return state.count;
    };
    expect(countAfterProbe(OWNER_SHUT_LINE - 0.001)).toBe(1);
    expect(countAfterProbe(OWNER_SHUT_LINE)).toBe(0);
    expect(countAfterProbe(OWNER_SHUT_LINE + 0.001)).toBe(0);
  });
});

// Issue #115, the depth-qualified episode redesign. The prediction and
// its refuters were committed first in docs/depth-qualified-episodes.txt;
// the traces here are that document's P1 to P3, verbatim.
describe("the episode boundary is the blink line, issue #115", () => {
  const OWNER_BLINK_LINE = 3.6;
  const OWNER_SHUT_LINE = longClosureThresholdMm(7.2);

  it("mirrors blink.ts at the boundary: strictly below opens an episode", () => {
    const eyeAfter = (apertureMm: number): string => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
      state = longClosureStep(
        state,
        100,
        apertureMm,
        OWNER_BLINK_LINE,
        OWNER_SHUT_LINE,
      );
      return state.eye;
    };
    expect(eyeAfter(OWNER_BLINK_LINE - 0.001)).toBe("closed");
    expect(eyeAfter(OWNER_BLINK_LINE)).toBe("open");
    expect(eyeAfter(OWNER_BLINK_LINE + 0.001)).toBe("open");
  });

  it("the owner's 700 ms two-phase closure lands in its bin (P1)", () => {
    // 300 ms drooping through the band, then 400 ms fully shut: the
    // verified consequence that filed the issue. Under the old wiring
    // this closure was refused by the blink counter (too long) and
    // missed here (truly shut span under the line). Now the clock
    // runs from the blink-line crossing at 100, so the event fires
    // the first frame past 600 — while the eyes are still shut — and
    // the recorded duration is the whole 700 ms episode.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    state = longClosureStep(state, 100, 3.4, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    state = longClosureStep(
      state,
      400,
      2.35,
      OWNER_BLINK_LINE,
      OWNER_SHUT_LINE,
    );
    expect(state.count).toBe(0);
    state = longClosureStep(
      state,
      601,
      2.35,
      OWNER_BLINK_LINE,
      OWNER_SHUT_LINE,
    );
    expect(state.count).toBe(1);
    expect(state.eye).toBe("closed");
    // The live readout speaks the full span since the blink line.
    expect(ongoingClosureMs(state, 601)).toBe(501);
    state = longClosureStep(state, 800, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(700);
  });

  it("a descent that dawdles past the maximum fires the frame shut is reached", () => {
    // The other order of the two conditions: the clock is long past
    // 500 ms while the lid is still in the band, and the event fires
    // the moment truly shut is proven — the earliest honest moment.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, 5.9, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    state = longClosureStep(state, 100, 3.4, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    state = longClosureStep(state, 700, 3.4, OWNER_BLINK_LINE, OWNER_SHUT_LINE);
    expect(state.count).toBe(0);
    state = longClosureStep(
      state,
      733,
      2.35,
      OWNER_BLINK_LINE,
      OWNER_SHUT_LINE,
    );
    expect(state.count).toBe(1);
  });
});

describe("the depth qualification", () => {
  it("a droop that never reaches shut stays a non-event at any length", () => {
    // Ten seconds between the lines: the episode clock runs the whole
    // time and the count never moves. Depth, not patience, is what
    // makes a long closure.
    const { state } = run([...frames(1, OPEN_MM), ...frames(10, 4.3)]);
    expect(state.count).toBe(0);
    expect(state.lastLongClosureDurationMs).toBeNull();
  });

  it("an inverted corridor degrades to the single-line detector, stated", () => {
    // A guided blink line at or below the shut line makes every
    // episode qualify on entry: the corridor caveat from the issue,
    // stated in docs/depth-qualified-episodes.txt and pinned here so
    // the degradation is a recorded behaviour, not an accident. The
    // cure — a personal shut floor — is issue #113's and 12.0a's.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, 4, 5);
    state = longClosureStep(state, 100, 3.9, 4, 5);
    state = longClosureStep(state, 601, 3.9, 4, 5);
    expect(state.count).toBe(1);
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
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    // Closed since 100. At 100 + MAX the closure is still blink sized.
    state = longClosureStep(
      state,
      100 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(0);
    // One millisecond past the line it is a long closure.
    state = longClosureStep(
      state,
      101 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
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
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      3000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(state, 3100, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
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
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 400, null, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 700, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(state.count).toBe(1);
  });

  it("abandons an unwitnessed closure past the bound, gaps stay gaps", () => {
    // Past LONG_CLOSURE_MAX_GAP_MS the old rule holds in full: no
    // event may be built on frames nobody saw, AND the frames after
    // the gap may be the same droop still going, so nothing fires
    // until the eye has been seen clearly open again.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 400, null, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      400 + LONG_CLOSURE_MAX_GAP_MS + 1,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      2000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    // Long past any line, and still nothing: not seen open since.
    expect(state.count).toBe(0);
    state = longClosureStep(state, 2100, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      2200,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      2201 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
  });

  it("keeps a fired count but records no duration when the end goes unwitnessed", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      2000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
    state = longClosureStep(state, 2100, null, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBeNull();
    expect(state.eye).toBe("unknown");
  });
});

describe("the reopen crossing, found by review before the pull request", () => {
  it("fires late on the reopen when the line was crossed between frames", () => {
    // The last closed frame sits at exactly the blink maximum, so no
    // closed frame ever crossed the line. The reopen measures 600 ms,
    // which blink.ts refuses. Without the late fire this witnessed
    // closure would land in neither bin.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      100 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(0);
    state = longClosureStep(state, 700, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(600);
    expect(state.eye).toBe("open");
  });

  it("runs the reopen boundary trio: exactly the maximum is still the blink's bin", () => {
    const reopenAt = (spanMs: number): LongClosureState => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
      state = longClosureStep(
        state,
        100,
        CLOSED_MM,
        BLINK_LINE_MM,
        SHUT_LINE_MM,
      );
      return longClosureStep(
        state,
        100 + spanMs,
        OPEN_MM,
        BLINK_LINE_MM,
        SHUT_LINE_MM,
      );
    };
    expect(reopenAt(LONG_CLOSURE_THRESHOLD_MS - 1).count).toBe(0);
    expect(reopenAt(LONG_CLOSURE_THRESHOLD_MS).count).toBe(0);
    expect(reopenAt(LONG_CLOSURE_THRESHOLD_MS + 1).count).toBe(1);
    expect(
      reopenAt(LONG_CLOSURE_THRESHOLD_MS + 1).lastLongClosureDurationMs,
    ).toBe(LONG_CLOSURE_THRESHOLD_MS + 1);
  });

  it("keeps the partition airtight: both reducers, one stream, one bin per closure", () => {
    // The central claim, run as code: for closures of many spans, fed
    // to BOTH reducers frame for frame against the SAME blink line,
    // exactly one of the two counters claims each closure. Since
    // issue #115 the two clocks start at the same crossing, which is
    // what makes the 500 ms boundary a genuine partition — and what
    // fix #126 demanded in writing before any clock moved.
    for (const spanMs of [150, 400, 500, 501, 533, 600, 2000]) {
      let blink = initialBlinkState;
      let long = initialLongClosureState;
      const feed = (nowMs: number, apertureMm: number): void => {
        blink = blinkStep(blink, nowMs, apertureMm, BLINK_LINE_MM);
        long = longClosureStep(
          long,
          nowMs,
          apertureMm,
          BLINK_LINE_MM,
          SHUT_LINE_MM,
        );
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

  it("the two-phase closure that used to land in neither bin lands in one", () => {
    // Issue #115's own reproduction, fed to both reducers: 300 ms in
    // the band, 400 ms fully shut. The blink counter refuses it (700
    // ms is too long) and this detector now claims it — one closure,
    // one bin, where the old wiring produced zero of each.
    let blink = initialBlinkState;
    let long = initialLongClosureState;
    const feed = (nowMs: number, apertureMm: number): void => {
      blink = blinkStep(blink, nowMs, apertureMm, BLINK_LINE_MM);
      long = longClosureStep(
        long,
        nowMs,
        apertureMm,
        BLINK_LINE_MM,
        SHUT_LINE_MM,
      );
    };
    feed(0, OPEN_MM);
    for (let t = 100; t < 400; t += 33) {
      feed(t, 4.3);
    }
    for (let t = 400; t < 800; t += 33) {
      feed(t, CLOSED_MM);
    }
    feed(800, OPEN_MM);
    expect(blink.blinkCount).toBe(0);
    expect(long.count).toBe(1);
    expect(blink.blinkCount + long.count).toBe(1);
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
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
    state = longClosureStep(state, 1100, null, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1200,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    // Resumed, still the same fired closure: the readout speaks the
    // FULL span since the eyes closed, and nothing fires again.
    expect(ongoingClosureMs(state, 1300)).toBe(1200);
    state = longClosureStep(
      state,
      1900,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
    // A real reopen, clearly open, then a new long closure: its own
    // event, exactly as before this row.
    state = longClosureStep(state, 2000, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(state.lastLongClosureDurationMs).toBe(1900);
    state = longClosureStep(
      state,
      2100,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      2101 + LONG_CLOSURE_THRESHOLD_MS,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(2);
  });

  it("records the reopen-measured duration across a survived gap", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(state, 1100, null, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1200,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(state, 1300, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    // One closure, 100 to 1300, with a witnessed hole no longer than
    // a blink: one event, and the duration spans to the reopen.
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(1200);
  });

  it("the reached-shut memory survives the gap with the clock", () => {
    // The depth qualification is part of the episode, so it crosses a
    // sub-blink gap the same way the clock does: shut was witnessed
    // before the flicker, the lid is back in the band after it, and
    // the episode fires on its original evidence.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, 4.3, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 200, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 300, 4.3, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 350, null, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 500, 4.3, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(state.count).toBe(0);
    state = longClosureStep(state, 601, 4.3, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(state.count).toBe(1);
  });
});

describe("ongoingClosureMs, the live readout", () => {
  it("speaks only during a long closure in progress", () => {
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    expect(ongoingClosureMs(state, 0)).toBeNull();
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    // Closed but still blink sized: silent.
    expect(ongoingClosureMs(state, 200)).toBeNull();
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    // Long now: the readout is the full time since the eyes closed.
    expect(ongoingClosureMs(state, 1000)).toBe(900);
  });
});

// The gradual descent case, asked for in closed issue #126 and filed as
// issue #115. Under the depth-qualified redesign the resting lid OPENS
// an episode — the clock runs — but the episode never reaches the shut
// line, so it still belongs to neither counter: too long to be a
// blink, never deep enough to be a long closure.
describe("a slow descent that stops between the two lines, issue #115", () => {
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
// from. The episode boundary has since moved to the blink line
// (issue #115), so the traces now carry the dry run's own blink line
// (3.8 mm, baseline 7.6) beside the 3.04 mm shut line they defined.

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
  const SHUT_MM = 3.04;
  const BLINK_MM = 3.8;

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
      state = longClosureStep(
        state,
        Math.round(t * 1000),
        apertureMm,
        BLINK_MM,
        SHUT_MM,
      );
    }
    return state;
  }

  it("collapses the iPhone hover shapes to one event each", () => {
    // Before 10.11 the same traces measured 3 and 2 events — one
    // sustained droop counted several times because its noise tops
    // out at 3.2 mm. The whole hover band now sits below the 3.8 mm
    // episode boundary, so it is one episode that dips below the shut
    // line: still one event each, at both rates, prediction P4.
    for (const rateHz of [30, 120]) {
      expect(trace(2.9, 0.5, rateHz, 6).count).toBe(1);
      expect(trace(2.9, 1 / 3, rateHz, 6).count).toBe(1);
    }
  });

  it("leaves the clean desktop shape untouched", () => {
    // The same noise around a centre the shut line never meets from
    // above: one closure, fired mid-closure, still in progress at the
    // end — every field exactly as the detector read it before.
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

describe("the re-arm gate, roadmap 10.11, anchored at the episode boundary", () => {
  it("does not fire again until the eye is seen clearly open", () => {
    // A reopen to just above the blink line — inside the noise band —
    // ends the episode but is not evidence the droop ended. The next
    // crossing arms nothing, however long it holds.
    const justAboveMm = BLINK_LINE_MM * 1.05;
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
    state = longClosureStep(
      state,
      1100,
      justAboveMm,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      1200,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      2500,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
  });

  it("re-arms the moment the boundary is cleared by the fraction", () => {
    const clearlyOpenMm = BLINK_LINE_MM * (1 + LONG_CLOSURE_REARM_FRACTION);
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(state, 100, CLOSED_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      1100,
      clearlyOpenMm,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      1200,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      1801,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(2);
  });

  it("endings sit at the episode boundary: exactly the blink line ends it", () => {
    // Hysteresis on the ARMING side only, blink.ts's own convention:
    // the episode ends the frame the aperture is back AT the line,
    // and the recorded span runs crossing to crossing.
    let state = initialLongClosureState;
    state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
    state = longClosureStep(
      state,
      1000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      3000,
      CLOSED_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    state = longClosureStep(
      state,
      3100,
      BLINK_LINE_MM,
      BLINK_LINE_MM,
      SHUT_LINE_MM,
    );
    expect(state.count).toBe(1);
    expect(state.lastLongClosureDurationMs).toBe(2100);
  });

  it("runs the boundary trio on the gap bound", () => {
    const build = (gapMs: number): LongClosureState => {
      let state = initialLongClosureState;
      state = longClosureStep(state, 0, OPEN_MM, BLINK_LINE_MM, SHUT_LINE_MM);
      state = longClosureStep(
        state,
        100,
        CLOSED_MM,
        BLINK_LINE_MM,
        SHUT_LINE_MM,
      );
      state = longClosureStep(state, 400, null, BLINK_LINE_MM, SHUT_LINE_MM);
      return longClosureStep(
        state,
        400 + gapMs,
        CLOSED_MM,
        BLINK_LINE_MM,
        SHUT_LINE_MM,
      );
    };
    // At and below the bound the closure survives with its clock:
    // 100 to 400+gap is already past the line, so it fires at once.
    expect(build(LONG_CLOSURE_MAX_GAP_MS - 1).count).toBe(1);
    expect(build(LONG_CLOSURE_MAX_GAP_MS).count).toBe(1);
    // Past it the cycle is abandoned and the gate is shut.
    expect(build(LONG_CLOSURE_MAX_GAP_MS + 1).count).toBe(0);
  });
});
