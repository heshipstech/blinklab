import { describe, expect, it } from "vitest";

import {
  LIGHT_CYCLES,
  LIGHT_PHASE_MS,
  LIGHT_SETTLE_MS,
  LIGHT_TOTAL_MS,
  lightPhaseAt,
  lightPhaseBackground,
  lightScheduleTransitions,
} from "../../src/core/lightSchedule";
import { lightStimulusMetadataRows } from "../../src/core/sessionMetadata";

// The stimulus for the pre-registered light-response experiment
// (docs/pupil-light-plan.md). The analysis divides the whole session
// into dark and bright seconds by this schedule and throws away the
// settle, so a boundary off by one second silently mislabels a second
// of pupil into the wrong phase. These tests pin every boundary.

describe("the fixed schedule", () => {
  it("is a 20s settle then six 20s dark/bright cycles, 260s total", () => {
    expect(LIGHT_SETTLE_MS).toBe(20_000);
    expect(LIGHT_PHASE_MS).toBe(20_000);
    expect(LIGHT_CYCLES).toBe(6);
    // Settle + six cycles of (dark + bright).
    expect(LIGHT_TOTAL_MS).toBe(260_000);
  });
});

describe("lightPhaseAt", () => {
  it("is settle for the whole discarded opening, including before zero", () => {
    // A negative elapsed must not read as a measured phase.
    expect(lightPhaseAt(-1)).toBe("settle");
    expect(lightPhaseAt(0)).toBe("settle");
    expect(lightPhaseAt(19_999)).toBe("settle");
  });

  it("starts the first cycle dark exactly when the settle ends", () => {
    // The settle is [0, 20000); dark begins AT 20000, not after it.
    expect(lightPhaseAt(20_000)).toBe("dark");
    expect(lightPhaseAt(39_999)).toBe("dark");
  });

  it("turns bright exactly at the first cycle's midpoint", () => {
    expect(lightPhaseAt(40_000)).toBe("bright");
    expect(lightPhaseAt(59_999)).toBe("bright");
  });

  it("alternates dark then bright for all six cycles", () => {
    // Sample the middle of every one of the twelve slots and check the
    // dark, bright, dark, bright, … pattern holds to the last cycle.
    for (let slot = 0; slot < LIGHT_CYCLES * 2; slot += 1) {
      const middle =
        LIGHT_SETTLE_MS + slot * LIGHT_PHASE_MS + LIGHT_PHASE_MS / 2;
      expect(lightPhaseAt(middle)).toBe(slot % 2 === 0 ? "dark" : "bright");
    }
  });

  it("is done at and after the end, never a thirteenth slot", () => {
    // The last bright slot ends AT 260000; that instant is already done.
    expect(lightPhaseAt(LIGHT_TOTAL_MS)).toBe("done");
    expect(lightPhaseAt(LIGHT_TOTAL_MS + 1)).toBe("done");
    // The last measured instant before the end is still bright.
    expect(lightPhaseAt(LIGHT_TOTAL_MS - 1)).toBe("bright");
  });
});

describe("lightScheduleTransitions", () => {
  it("lists settle, twelve alternating slots, then done", () => {
    const boundaries = lightScheduleTransitions();
    expect(boundaries).toEqual([
      { atMs: 0, phase: "settle" },
      { atMs: 20_000, phase: "dark" },
      { atMs: 40_000, phase: "bright" },
      { atMs: 60_000, phase: "dark" },
      { atMs: 80_000, phase: "bright" },
      { atMs: 100_000, phase: "dark" },
      { atMs: 120_000, phase: "bright" },
      { atMs: 140_000, phase: "dark" },
      { atMs: 160_000, phase: "bright" },
      { atMs: 180_000, phase: "dark" },
      { atMs: 200_000, phase: "bright" },
      { atMs: 220_000, phase: "dark" },
      { atMs: 240_000, phase: "bright" },
      { atMs: 260_000, phase: "done" },
    ]);
  });

  it("agrees with lightPhaseAt at every boundary it names", () => {
    // The two ways of asking the same question must never diverge: each
    // boundary's phase is what lightPhaseAt says at that instant (except
    // the closing "done" sentinel, tested above).
    for (const boundary of lightScheduleTransitions()) {
      if (boundary.phase === "done") {
        continue;
      }
      expect(lightPhaseAt(boundary.atMs)).toBe(boundary.phase);
    }
  });
});

describe("lightPhaseBackground", () => {
  it("paints bright near-white and dark near-black", () => {
    expect(lightPhaseBackground("bright")).toBe("#ffffff");
    expect(lightPhaseBackground("dark")).toBe("#000000");
  });

  it("shows the settle as dark, so the eye is already dark-adapted", () => {
    // The settle's colour must match dark, not sit between the two, or
    // the pupil enters the first measured dark phase mid-constriction.
    expect(lightPhaseBackground("settle")).toBe(lightPhaseBackground("dark"));
  });

  it("shows done as a neutral grey that is neither stimulus", () => {
    const done = lightPhaseBackground("done");
    expect(done).not.toBe(lightPhaseBackground("dark"));
    expect(done).not.toBe(lightPhaseBackground("bright"));
  });
});

describe("lightStimulusMetadataRows", () => {
  it("writes nothing for a session with no stimulus", () => {
    // A null start is not a light-response session; it must add no rows,
    // the same as an absent pseudonym.
    expect(lightStimulusMetadataRows(null)).toEqual([]);
  });

  it("records the schedule and the start in the timestamp clock", () => {
    expect(lightStimulusMetadataRows(1_725_000_000)).toEqual([
      "# light_stimulus: 6 cycles of 20s dark then 20s bright after a 20s " +
        "settle (docs/pupil-light-plan.md)",
      "# light_settle_ms: 20000",
      "# light_phase_ms: 20000",
      "# light_cycles: 6",
      "# light_stimulus_start_ms: 1725000000",
    ]);
  });
});
