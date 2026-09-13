import { describe, expect, it } from "vitest";

import {
  GUIDED_CALIBRATION_PHASE_MS,
  GUIDED_MIN_FACE_MS_PER_PHASE,
  collectCalibrationSample,
  effectiveBlinkLineMm,
  emptyGuidedCalibration,
  resolveGuidedCalibration,
  startCalibrationSession,
  calibrationSessionStep,
  serializeBlinkCalibration,
  parseBlinkCalibration,
  type CalibrationSessionState,
  type GuidedCalibrationSamples,
  type StoredBlinkCalibration,
} from "../../src/core/guidedCalibration";
import { GUIDED_CALIBRATION_MIN_SAMPLES } from "../../src/core/constants";
import { FACE_TIME_FRAME_CREDIT_MS } from "../../src/core/faceSeconds";
import { aStoredLine } from "../support/storedLine";

// The guided blink-line calibration measures a person's OWN open and
// closed aperture through two held phases, then places the personal
// line in the real gap between them. The passive baseline assumes
// closed is near zero and puts the line at half of open; a guided run
// measures the real closed value. A refused calibration is a result,
// not an accident — too few samples in either phase, or a closure the
// instrument did not register (the personal echo of the corpus recall
// ceiling), each yields a refusal rather than a guessed line.

function repeat(value: number, count: number): number[] {
  return Array.from({ length: count }, () => value);
}

const ENOUGH = 40; // comfortably over the minimum

function samples(open: number[], closed: number[]): GuidedCalibrationSamples {
  return { open, closed };
}

// Generous face time on both phases, so the pre-10.12c tests keep
// deciding on the clause each was written for.
const HELD_MS = 3000;

function resolveHeld(s: GuidedCalibrationSamples) {
  return resolveGuidedCalibration(s, HELD_MS, HELD_MS);
}

describe("collectCalibrationSample", () => {
  it("routes a trusted reading to the phase in progress", () => {
    let s = emptyGuidedCalibration;
    s = collectCalibrationSample(s, "open", 8);
    s = collectCalibrationSample(s, "closed", 2);
    expect(s.open).toEqual([8]);
    expect(s.closed).toEqual([2]);
  });

  it("drops a null aperture rather than storing it", () => {
    let s = emptyGuidedCalibration;
    s = collectCalibrationSample(s, "open", null);
    s = collectCalibrationSample(s, "open", 8);
    expect(s.open).toEqual([8]);
  });
});

describe("resolveGuidedCalibration, ready", () => {
  it("places the personal line at the midpoint of open and closed", () => {
    const result = resolveHeld(samples(repeat(8, ENOUGH), repeat(2, ENOUGH)));
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.openMedianMm).toBe(8);
      expect(result.closedMedianMm).toBe(2);
      expect(result.personalLineMm).toBe(5);
    }
  });
});

describe("resolveGuidedCalibration, refusals", () => {
  // Roadmap 10.1c, ladder D2. The refusals below use 5 samples, which
  // is nowhere near the edge and would pass with the floor at any of
  // 6 through 40. These are literals at the edge: 30 trusted samples
  // per phase, one second at 30 fps, chosen before any guided data
  // was read and never tuned against it.
  it("refuses at 29 samples and resolves at 30, as literals", () => {
    expect(resolveHeld(samples(repeat(8, 29), repeat(2, 30)))).toEqual({
      kind: "refused",
      reason: "not-enough-open",
    });
    expect(resolveHeld(samples(repeat(8, 30), repeat(2, 29)))).toEqual({
      kind: "refused",
      reason: "not-enough-closed",
    });
    expect(resolveHeld(samples(repeat(8, 30), repeat(2, 30))).kind).toBe(
      "ready",
    );
  });

  it("refuses when the open phase has too few samples", () => {
    const result = resolveHeld(samples(repeat(8, 5), repeat(2, ENOUGH)));
    expect(result).toEqual({ kind: "refused", reason: "not-enough-open" });
  });

  it("refuses when the closed phase has too few samples", () => {
    const result = resolveHeld(samples(repeat(8, ENOUGH), repeat(2, 5)));
    expect(result).toEqual({ kind: "refused", reason: "not-enough-closed" });
  });

  it("refuses when the closure was not registered, the ceiling's echo", () => {
    // Closed median 7 against open 8 is only 12% below: the instrument
    // did not see this person's closure, so no line can be drawn.
    const result = resolveHeld(samples(repeat(8, ENOUGH), repeat(7, ENOUGH)));
    expect(result).toEqual({
      kind: "refused",
      reason: "closure-not-registered",
    });
  });

  it("layers the ceiling behind the separation floor at the boundary", () => {
    // The separation floor is 30%: a closed median ABOVE 70% of open is
    // refused first, as an unregistered closure. Exactly AT 70% the
    // closure clears that floor — but the line then sits at 0.85 of the
    // (flat) open distribution, right on the soundness ceiling (11.6a),
    // so it is refused there instead, now for the ceiling's reason. The
    // two guards meet at the boundary and neither lets a line at 0.85 of
    // open through.
    expect(
      resolveHeld(samples(repeat(10, ENOUGH), repeat(7.01, ENOUGH))),
    ).toEqual({ kind: "refused", reason: "closure-not-registered" });
    expect(resolveHeld(samples(repeat(10, ENOUGH), repeat(7, ENOUGH)))).toEqual(
      { kind: "refused", reason: "line-above-open-floor" },
    );
  });
});

describe("resolveGuidedCalibration, the soundness ceiling (roadmap 11.6a)", () => {
  // The separation floor bounds the closed median; the ceiling bounds
  // the LINE against where the open eye actually droops — its lower
  // tail, the 10th percentile of the open samples — so a midpoint that
  // survives a sound separation can still be refused for sitting inside
  // the relaxed-open band, where it would arm on ordinary opening
  // (docs/blink-line-adoption.txt, the pre-registered droop risk).

  it("passes a sound line well below the open tail", () => {
    // line 5, tail 8, ceiling 0.85*8 = 6.8: clear. Pins the fraction —
    // drop it far enough and this sound calibration would be refused.
    const result = resolveHeld(samples(repeat(8, ENOUGH), repeat(2, ENOUGH)));
    expect(result.kind).toBe("ready");
  });

  it("refuses a line at the ceiling and admits one just below it", () => {
    // Open flat at 10, so tail = 10 and ceiling = 8.5. A closed median
    // of 7 puts the line exactly at 8.5 — refused, the row's "a line at
    // 0.85 of open is refused". Drop the closed median a hair and the
    // line clears.
    expect(resolveHeld(samples(repeat(10, ENOUGH), repeat(7, ENOUGH)))).toEqual(
      { kind: "refused", reason: "line-above-open-floor" },
    );
    const justBelow = resolveHeld(
      samples(repeat(10, ENOUGH), repeat(6.9, ENOUGH)),
    );
    expect(justBelow.kind).toBe("ready");
  });

  it("reads the open LOWER TAIL, not the median: a droopy open eye is refused where a tight one passes", () => {
    // Two open distributions with the SAME median (10) and the SAME
    // closed median (5), so a median-relative check would treat them
    // alike. The droopy one dips to 8 in its lower tail; the tight one
    // holds near 10 throughout.
    //
    //   line = (10 + 5)/2 = 7.5 in both.
    //   droopy: tail (p10) = 8,  ceiling 0.85*8 = 6.8  -> 7.5 refused.
    //   tight:  tail (p10) = 10, ceiling 0.85*10 = 8.5 -> 7.5 ready.
    //
    // A tenth percentile that slid up to the median (p50) would read 10
    // for BOTH and admit both, so this pins the percentile.
    const droopyOpen = [...repeat(8, 4), ...repeat(10, 36)]; // p10=8, p50=10
    const tightOpen = repeat(10, 40); // p10=p50=10
    const closed = repeat(5, ENOUGH);
    expect(resolveHeld(samples(droopyOpen, closed))).toEqual({
      kind: "refused",
      reason: "line-above-open-floor",
    });
    expect(resolveHeld(samples(tightOpen, closed)).kind).toBe("ready");
  });
});

describe("the calibration session state machine", () => {
  // Drive a session from nowMs 0 by feeding one aperture per 33 ms
  // tick until it reaches "done", capturing the phase seen each tick.
  // In the verification phase it dips the aperture closed for one tick
  // every twenty (about 660 ms apart, past the refractory), producing
  // several clean blinks against the candidate line so a sound run
  // passes verification; otherwise it holds the eye open.
  function run(
    openMm: number,
    closedMm: number,
  ): { state: CalibrationSessionState; phasesSeen: string[] } {
    let state = startCalibrationSession(0);
    const phasesSeen: string[] = [];
    for (let tick = 1; tick <= 800 && state.kind !== "done"; tick++) {
      let mm: number;
      if (state.kind === "collecting") {
        phasesSeen.push(state.phase);
        mm = state.phase === "closed" ? closedMm : openMm;
      } else {
        phasesSeen.push("verifying");
        mm = tick % 20 === 0 ? closedMm : openMm;
      }
      state = calibrationSessionStep(state, tick * 33, mm);
    }
    return { state, phasesSeen };
  }

  it("starts collecting the open phase", () => {
    const state = startCalibrationSession(1000);
    expect(state.kind).toBe("collecting");
    if (state.kind === "collecting") {
      expect(state.phase).toBe("open");
    }
  });

  it("walks open then closed then done, in that order", () => {
    const { state, phasesSeen } = run(8, 2);
    expect(state.kind).toBe("done");
    expect(phasesSeen).toContain("open");
    expect(phasesSeen).toContain("closed");
    // Open always precedes closed: the last open tick is before the
    // first closed tick.
    expect(phasesSeen.lastIndexOf("open")).toBeLessThan(
      phasesSeen.indexOf("closed"),
    );
  });

  it("resolves a clean run to a ready line at the midpoint", () => {
    const { state } = run(8, 2);
    expect(state.kind).toBe("done");
    if (state.kind === "done" && state.result.kind === "ready") {
      expect(state.result.personalLineMm).toBe(5);
    } else {
      throw new Error("expected a ready result");
    }
  });

  it("resolves a run where the eye never closed to a refusal", () => {
    const { state } = run(8, 8);
    expect(state.kind).toBe("done");
    if (state.kind === "done") {
      expect(state.result.kind).toBe("refused");
    }
  });

  it("holds the open phase until its duration elapses", () => {
    let state = startCalibrationSession(0);
    state = calibrationSessionStep(state, GUIDED_CALIBRATION_PHASE_MS - 1, 8);
    expect(state.kind === "collecting" && state.phase).toBe("open");
    state = calibrationSessionStep(state, GUIDED_CALIBRATION_PHASE_MS, 8);
    expect(state.kind === "collecting" && state.phase).toBe("closed");
  });

  it("ignores a backwards clock, state unchanged", () => {
    const state = startCalibrationSession(1000);
    expect(calibrationSessionStep(state, 500, 8)).toBe(state);
  });

  it("is terminal once done", () => {
    const { state } = run(8, 2);
    expect(calibrationSessionStep(state, 999999, 5)).toBe(state);
  });
});

describe("the per-phase settle window (roadmap 11.6a)", () => {
  // A phase begins with an instruction to read and lids to move into the
  // held position; frames during that window carry a confident wrong
  // label, so nothing is collected until the settle window has passed
  // since the phase began. The boundary is pinned with literals — a
  // frame AT 800 ms is still dropped (the <= boundary the gaze capture
  // uses), one at 801 ms is kept — so a shrunk or removed settle turns
  // this red.
  it("drops a frame at the settle boundary and keeps the next one", () => {
    let state = startCalibrationSession(0);
    state = calibrationSessionStep(state, 800, 8);
    expect(state.kind === "collecting" && state.samples.open).toEqual([]);
    state = calibrationSessionStep(state, 801, 8);
    expect(state.kind === "collecting" && state.samples.open).toEqual([8]);
  });

  it("settles each phase on its own clock, not only the first", () => {
    let state = startCalibrationSession(0);
    // Cross into the closed phase; the transition is time-based at 3 s,
    // so held-open frames past the open settle carry the session there.
    for (let t = 810; t <= GUIDED_CALIBRATION_PHASE_MS; t += 30) {
      state = calibrationSessionStep(state, t, 8);
    }
    expect(state.kind === "collecting" && state.phase).toBe("closed");
    const closedStart = state.kind === "collecting" ? state.startedAtMs : -1;
    // The closed phase has its OWN settle: a frame at its boundary is
    // dropped, one past it is kept.
    state = calibrationSessionStep(state, closedStart + 800, 2);
    expect(state.kind === "collecting" && state.samples.closed).toEqual([]);
    state = calibrationSessionStep(state, closedStart + 801, 2);
    expect(state.kind === "collecting" && state.samples.closed).toEqual([2]);
  });
});

describe("the verification phase (roadmap 11.6a)", () => {
  const DT = 40;

  // Drives a whole session: open hold at openMm, closed hold at
  // closedMm, then the verification phase. In verification it dips the
  // aperture closed for one frame at each of `verifyBlinks` moments,
  // spaced 300 ms apart (well past the 150 ms refractory) and held open
  // otherwise, so exactly `verifyBlinks` clean blinks land against the
  // candidate line. A refusal from the holds ends the session before
  // verification and nothing is fed to it.
  function fullSession(
    openMm: number,
    closedMm: number,
    verifyBlinks: number,
  ): CalibrationSessionState {
    let state = startCalibrationSession(0);
    let t = 0;
    while (state.kind === "collecting" && t < 100000) {
      const mm = state.phase === "closed" ? closedMm : openMm;
      state = calibrationSessionStep(state, t, mm);
      t += DT;
    }
    if (state.kind === "verifying") {
      const startedAtMs = state.startedAtMs;
      let fired = 0;
      while (state.kind === "verifying" && t < 100000) {
        const elapsed = t - startedAtMs;
        const fire = fired < verifyBlinks && elapsed >= (fired + 1) * 300;
        state = calibrationSessionStep(state, t, fire ? closedMm : openMm);
        if (fire) fired += 1;
        t += DT;
      }
    }
    return state;
  }

  it("stores a sound line that catches the person's own blinks", () => {
    const state = fullSession(8, 2, 3);
    expect(state.kind).toBe("done");
    if (state.kind === "done") {
      expect(state.result.kind).toBe("ready");
      if (state.result.kind === "ready") {
        expect(state.result.personalLineMm).toBe(5);
      }
      expect(state.blinksCaught).toBe(3);
    }
  });

  it("refuses a sound line that misses the person's blinks", () => {
    // The medians are sound (line 5) but only one blink lands in
    // verification, below the floor of two, so the line is not stored.
    const state = fullSession(8, 2, 1);
    expect(state).toMatchObject({
      kind: "done",
      result: { kind: "refused", reason: "verification-failed" },
      blinksCaught: 1,
    });
  });

  it("runs the verification floor: two blinks pass, one does not", () => {
    const two = fullSession(8, 2, 2);
    const one = fullSession(8, 2, 1);
    expect(two.kind === "done" && two.result.kind).toBe("ready");
    expect(one.kind === "done" && one.result.kind).toBe("refused");
  });

  it("never reaches verification when the line is already unsound", () => {
    // Closed never registered (open 8, closed 8): the candidate is
    // refused on separation, so verification is skipped and blinksCaught
    // stays null — a line nobody could draw is not one to blink at.
    const state = fullSession(8, 8, 3);
    expect(state).toMatchObject({
      kind: "done",
      result: { kind: "refused", reason: "closure-not-registered" },
      blinksCaught: null,
    });
  });
});

describe("stored blink calibration, serialise and validated parse", () => {
  const good = aStoredLine({
    personalLineMm: 5,
    openMedianMm: 8,
    closedMedianMm: 2,
  });

  it("round-trips a ready calibration", () => {
    const raw = serializeBlinkCalibration(good);
    expect(parseBlinkCalibration(raw)).toEqual(good);
  });

  it("rejects non-JSON", () => {
    expect(parseBlinkCalibration("not json {")).toBeNull();
  });

  it("rejects a missing field", () => {
    expect(
      parseBlinkCalibration(
        JSON.stringify({ personalLineMm: 5, openMedianMm: 8 }),
      ),
    ).toBeNull();
  });

  it("rejects a non-finite number", () => {
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: null,
          openMedianMm: 8,
          closedMedianMm: 2,
        }),
      ),
    ).toBeNull();
    expect(
      parseBlinkCalibration(
        '{"personalLineMm":5,"openMedianMm":8,"closedMedianMm":"x"}',
      ),
    ).toBeNull();
  });

  it("rejects a zero median, which a real calibration never produces", () => {
    // resolveGuidedCalibration medians real apertures, all above zero,
    // so a stored zero is a degenerate or tampered entry, not a
    // calibration.
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: 4,
          openMedianMm: 8,
          closedMedianMm: 0,
        }),
      ),
    ).toBeNull();
  });

  it("rejects a line that does not sit between closed and open", () => {
    // A line at or outside the open/closed bracket is not one these
    // medians could have produced: a tampered or stale-format entry.
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: 9,
          openMedianMm: 8,
          closedMedianMm: 2,
        }),
      ),
    ).toBeNull();
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: 1,
          openMedianMm: 8,
          closedMedianMm: 2,
        }),
      ),
    ).toBeNull();
  });
});

describe("effectiveBlinkLineMm, which line the detector reads", () => {
  // The whole of increment 3: prefer the person's own measured line
  // when they have one, otherwise fall back to the passive baseline
  // line. Kept a pure decision so the precedence is pinned and main.ts
  // stays thin. The corpus never has a stored calibration, so this
  // returns the baseline line there and the benchmark is unchanged.
  const stored: StoredBlinkCalibration = aStoredLine({
    personalLineMm: 5,
    openMedianMm: 8,
    closedMedianMm: 2,
  });

  it("uses the guided line when a calibration is present", () => {
    expect(effectiveBlinkLineMm(stored, 3.9)).toBe(5);
  });

  it("uses the guided line even when the baseline has none", () => {
    // A calibrated person needs no passive baseline at all: the guided
    // line is a complete ruler on its own.
    expect(effectiveBlinkLineMm(stored, null)).toBe(5);
  });

  it("falls back to the baseline line when there is no calibration", () => {
    // This is every corpus run: no stored calibration, so the detector
    // reads exactly the baseline line it always did.
    expect(effectiveBlinkLineMm(null, 3.9)).toBe(3.9);
  });

  it("returns null when neither a calibration nor a baseline line exists", () => {
    expect(effectiveBlinkLineMm(null, null)).toBeNull();
  });
});

// Roadmap 10.12c, prediction first in docs/face-seconds.txt: each
// phase floor also demands a span of trusted-face TIME, because a
// display outpacing the camera fills the tick floor with duplicate
// photographs.
describe("the guided face-time floors, roadmap 10.12c", () => {
  it("derives the per-phase span from the tick floor", () => {
    expect(GUIDED_MIN_FACE_MS_PER_PHASE).toBe(
      GUIDED_CALIBRATION_MIN_SAMPLES * FACE_TIME_FRAME_CREDIT_MS,
    );
  });

  it("refuses a phase filled by duplicates of 25 photographs", () => {
    // The row's synthetic, verbatim: 25 distinct photographs credit
    // at most 1000 ms however many duplicate ticks a 120 Hz display
    // adds, and 1000 ms is under the 1200 ms floor.
    const starved = 25 * FACE_TIME_FRAME_CREDIT_MS;
    expect(
      resolveGuidedCalibration(
        samples(repeat(8, 120), repeat(2, 40)),
        starved,
        HELD_MS,
      ),
    ).toEqual({ kind: "refused", reason: "not-enough-open" });
    expect(
      resolveGuidedCalibration(
        samples(repeat(8, 40), repeat(2, 120)),
        HELD_MS,
        starved,
      ),
    ).toEqual({ kind: "refused", reason: "not-enough-closed" });
  });

  it("runs the boundary trio on the per-phase span", () => {
    const at = GUIDED_MIN_FACE_MS_PER_PHASE;
    const under = resolveGuidedCalibration(
      samples(repeat(8, 40), repeat(2, 40)),
      at - 1,
      HELD_MS,
    );
    expect(under.kind).toBe("refused");
    expect(
      resolveGuidedCalibration(
        samples(repeat(8, 40), repeat(2, 40)),
        at,
        HELD_MS,
      ).kind,
    ).toBe("ready");
  });

  it("a session whose phases are starved of face refuses end to end", () => {
    // Driven through the session step at the 120 Hz duplicate pace:
    // a quarter second of fed frames per three-second phase.
    let session = startCalibrationSession(0);
    for (let t = 0; t <= 3000; t += 8) {
      session = calibrationSessionStep(session, t, t <= 250 ? 8 : null);
    }
    for (let t = 3008; t <= 6008; t += 8) {
      session = calibrationSessionStep(session, t, t <= 3258 ? 2 : null);
    }
    expect(session.kind).toBe("done");
    if (session.kind === "done") {
      expect(session.result.kind).toBe("refused");
    }
  });

  it("a genuinely held session still resolves, at any display pace", () => {
    let session = startCalibrationSession(0);
    for (let t = 0; t <= 3000; t += 8) {
      session = calibrationSessionStep(session, t, 8);
    }
    for (let t = 3008; t <= 6008; t += 8) {
      session = calibrationSessionStep(session, t, 2);
    }
    // The holds produced a sound candidate; the verification phase now
    // runs. Blink against the candidate line — one closed frame every
    // 400 ms, well past the refractory — so the line is confirmed and
    // the session resolves ready.
    for (let t = 6016; t <= 12016; t += 8) {
      session = calibrationSessionStep(session, t, t % 400 < 8 ? 2 : 8);
    }
    expect(session.kind).toBe("done");
    if (session.kind === "done") {
      expect(session.result.kind).toBe("ready");
    }
  });
});
