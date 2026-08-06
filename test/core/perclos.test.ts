import { describe, expect, it } from "vitest";

import { EYES_SHUT_FRACTION } from "../../src/core/longClosure";
import perclosSource from "../../src/core/perclos.ts?raw";
import {
  emptyPerclos,
  PERCLOS_CLOSED_FRACTION,
  PERCLOS_MIN_OBSERVED_MS,
  perclosStep,
  perclosValue,
  type PerclosState,
} from "../../src/core/perclos";

const DT_MS = 1000 / 30;
const BASELINE_MM = 10;
const OPEN_MM = 8;
const CLOSED_MM = 1;

// Feeds a scripted minute: each entry is one second of frames, either
// open, closed, or untrusted (null aperture).
function runSeconds(
  script: readonly ("open" | "closed" | "gap")[],
  baselineMm: number | null = BASELINE_MM,
): { state: PerclosState; endMs: number } {
  let state = emptyPerclos();
  let t = 0;
  for (const second of script) {
    for (let frame = 0; frame < 30; frame++) {
      const apertureMm =
        second === "gap" ? null : second === "closed" ? CLOSED_MM : OPEN_MM;
      state = perclosStep(state, t, apertureMm, baselineMm);
      t += DT_MS;
    }
  }
  return { state, endMs: t - DT_MS };
}

describe("perclosValue on staged minutes", () => {
  it("reads exactly the staged closure fraction", () => {
    // 54 seconds open, 6 seconds closed: PERCLOS 0.1 on the nose.
    const script = [
      ...Array<"open">(54).fill("open"),
      ...Array<"closed">(6).fill("closed"),
    ];
    const { state, endMs } = runSeconds(script);
    expect(perclosValue(state, endMs)).toBeCloseTo(0.1, 12);
  });

  it("reads zero for a fully open minute and one for a fully closed one", () => {
    const open = runSeconds(Array<"open">(60).fill("open"));
    expect(perclosValue(open.state, open.endMs)).toBe(0);
    const closed = runSeconds(Array<"closed">(60).fill("closed"));
    expect(perclosValue(closed.state, closed.endMs)).toBe(1);
  });

  it("excludes untrusted frames from both sides of the ratio", () => {
    // 18 open, 2 closed, no gaps: 0.1. The same with gap seconds
    // wedged in: still 0.1, gaps are gaps, not open eyes.
    const clean = runSeconds([
      ...Array<"open">(18).fill("open"),
      ...Array<"closed">(2).fill("closed"),
    ]);
    const gappy = runSeconds([
      ...Array<"open">(9).fill("open"),
      ...Array<"gap">(6).fill("gap"),
      ...Array<"open">(9).fill("open"),
      ...Array<"closed">(2).fill("closed"),
    ]);
    expect(perclosValue(clean.state, clean.endMs)).toBeCloseTo(0.1, 12);
    expect(perclosValue(gappy.state, gappy.endMs)).toBeCloseTo(0.1, 12);
  });

  it("forgets closures older than the window", () => {
    // Ten fully closed seconds, then seventy open ones: by the end
    // the closed stretch has slid out entirely.
    const { state, endMs } = runSeconds([
      ...Array<"closed">(10).fill("closed"),
      ...Array<"open">(70).fill("open"),
    ]);
    expect(perclosValue(state, endMs)).toBe(0);
  });
});

describe("the observation minimum", () => {
  it("refuses a window observed for less than 15 seconds", () => {
    const { state, endMs } = runSeconds(Array<"open">(10).fill("open"));
    expect(perclosValue(state, endMs)).toBeNull();
  });

  it("runs the boundary trio at exactly the minimum span", () => {
    let state = emptyPerclos();
    state = perclosStep(state, 0, OPEN_MM, BASELINE_MM);
    const justUnder = perclosStep(
      state,
      PERCLOS_MIN_OBSERVED_MS - 1,
      OPEN_MM,
      BASELINE_MM,
    );
    expect(perclosValue(justUnder, PERCLOS_MIN_OBSERVED_MS - 1)).toBeNull();
    const exactly = perclosStep(
      justUnder,
      PERCLOS_MIN_OBSERVED_MS,
      OPEN_MM,
      BASELINE_MM,
    );
    expect(perclosValue(exactly, PERCLOS_MIN_OBSERVED_MS)).toBe(0);
  });

  it("ignores gap frames when measuring the observed span", () => {
    // Two valid frames 10 seconds apart, padded with gaps beyond the
    // minimum: the VALID span is still only 10 seconds, so null.
    let state = emptyPerclos();
    state = perclosStep(state, 0, OPEN_MM, BASELINE_MM);
    state = perclosStep(state, 10000, OPEN_MM, BASELINE_MM);
    state = perclosStep(state, 20000, null, BASELINE_MM);
    expect(perclosValue(state, 20000)).toBeNull();
  });

  it("returns null for an empty state", () => {
    expect(perclosValue(emptyPerclos(), 0)).toBeNull();
  });
});

describe("the closed line moved to the shut line, fix #113", () => {
  it("is the long closure detector's shut line, aliased so the two cannot drift", () => {
    // The literature's P80 (20 percent) proved unreachable: the
    // instrument reads fully shut eyes as about a third of baseline,
    // and PERCLOS read 0.0 percent through a witnessed 12.9 second
    // closure. Both watchers of "shut" now share one measured line.
    expect(PERCLOS_CLOSED_FRACTION).toBe(EYES_SHUT_FRACTION);
    expect(PERCLOS_CLOSED_FRACTION).toBe(0.4);
  });

  it("replays the owner's blindness experiment: the closure now registers", () => {
    // The 2026-08-06 measurement: baseline 7.2 mm, eyes fully shut
    // at 2.35 mm for six of sixty seconds. Under the 20 percent line
    // (1.44 mm) this read 0.0 percent. Under the shut line (2.88 mm)
    // it must read exactly ten percent.
    const script = [
      ...Array<"open">(54).fill("open"),
      ...Array<"closed">(6).fill("closed"),
    ];
    let state = emptyPerclos();
    let t = 0;
    for (const second of script) {
      for (let frame = 0; frame < 30; frame++) {
        state = perclosStep(state, t, second === "closed" ? 2.35 : 5.9, 7.2);
        t += 1000 / 30;
      }
    }
    expect(perclosValue(state, t - 1000 / 30)).toBeCloseTo(0.1, 12);
  });

  it("still refuses the owner's reading droop as closed time", () => {
    // Lids low at 3.4 mm while reading (47 percent of the 7.2 mm
    // baseline, inside the measured 45 to 50 percent droop band) and
    // a harder probe just 0.02 mm above the 2.88 mm shut line: a
    // full minute of either reads zero percent, not a false fatigue
    // signal.
    for (const droopMm of [3.4, 2.9]) {
      let state = emptyPerclos();
      let t = 0;
      for (let frame = 0; frame < 1800; frame++) {
        state = perclosStep(state, t, droopMm, 7.2);
        t += 1000 / 30;
      }
      expect(perclosValue(state, t - 1000 / 30)).toBe(0);
    }
  });

  it("enforces aliased-not-copied at the source level", () => {
    // Value equality cannot tell an alias from a copied literal, so
    // this reads the source: the constant must be defined AS the
    // long closure detector's fraction, not restated.
    expect(perclosSource).toContain(
      "export const PERCLOS_CLOSED_FRACTION = EYES_SHUT_FRACTION;",
    );
  });
});

describe("the closed line", () => {
  it("runs the boundary trio: exactly at the shut line stays open", () => {
    // Amended by fix #113: strictly below closes, exactly at stays
    // open, the same convention as every other aperture detector, so
    // the two consumers of the shared line agree at the line itself.
    const threshold = PERCLOS_CLOSED_FRACTION * BASELINE_MM;
    let state = emptyPerclos();
    state = perclosStep(state, 0, threshold - 0.001, BASELINE_MM);
    state = perclosStep(state, 20000, threshold, BASELINE_MM);
    state = perclosStep(state, 40000, threshold + 0.001, BASELINE_MM);
    // Three samples: closed, open, open.
    expect(perclosValue(state, 40000)).toBeCloseTo(1 / 3, 12);
  });

  it("classifies at push time, a later baseline never rewrites history", () => {
    // The same 5 mm aperture is open against a 10 mm baseline and
    // closed against a 30 mm one. Each sample keeps the verdict of
    // its own moment.
    let state = emptyPerclos();
    state = perclosStep(state, 0, 5, 10);
    state = perclosStep(state, 20000, 5, 30);
    expect(perclosValue(state, 20000)).toBeCloseTo(1 / 2, 12);
  });

  it("counts a missing baseline as untrusted, not open", () => {
    let state = emptyPerclos();
    state = perclosStep(state, 0, OPEN_MM, null);
    state = perclosStep(state, 20000, OPEN_MM, null);
    expect(perclosValue(state, 20000)).toBeNull();
  });
});
