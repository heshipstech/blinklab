import { describe, expect, it } from "vitest";

import {
  APERTURE_HYSTERESIS_FRACTION,
  BASELINE_THRESHOLD_FRACTION,
  MAX_BLINK_DURATION_MS,
} from "../../src/core/constants";
import {
  armLineMm,
  detect,
  msBelow,
  type Blink,
  type Optics,
} from "../fixtures/blinkTrace";

// Issue #178: MAX_BLINK_DURATION_MS may be costing detections, and
// closed issue #126 says it is load-bearing as a noise filter. Both
// pieces of evidence look sound and they point opposite ways.
//
// This file changes no behaviour. It reproduces both cases so the
// conflict lives in the code rather than in two issue threads, which is
// step 3 of the issue's own suggested order. The constant is NOT moved:
// that is step 4 and it is the owner's.
//
// What settles it is a variable neither side named. The ceiling's two
// jobs do not overlap; which one it is doing depends entirely on where
// the blink line sits relative to the resting eyelid, and that ratio is
// `baseline_over_resting` from the validation round's fifth check.

const RESTING_MM = 7.0;

/** Optics for a given learned baseline, in multiples of the resting eye. */
function opticsForRatio(baselineOverResting: number): Optics {
  return {
    openMm: RESTING_MM,
    thresholdMm: RESTING_MM * baselineOverResting * BASELINE_THRESHOLD_FRACTION,
  };
}

/** The owner's own five sessions ran between 1.12 and 1.41. */
const HEALTHY = opticsForRatio(1.11);
/** The blink line has climbed into the resting eye's own wobble. */
const RATCHETED = opticsForRatio(1.97);

/** A real blink: deep, and as slow as the caller asks. */
function realBlink(totalMs: number): Blink {
  return {
    minMm: 2.0,
    closeMs: Math.round(totalMs / 3),
    openMs: totalMs - Math.round(totalMs / 3),
  };
}

/** A wobble of the resting eyelid, not a blink at all. */
function wobble(depthMm: number, totalMs: number): Blink {
  return {
    minMm: RESTING_MM - depthMm,
    closeMs: Math.round(totalMs / 2),
    openMs: totalMs - Math.round(totalMs / 2),
  };
}

/** Counted at a sampling rate fast enough that sampling is not the issue. */
function counted(blink: Blink, optics: Optics): boolean {
  return detect(blink, optics, 120, 0).count === 1;
}

if (process.env.BLINKLAB_PRINT_TABLE !== undefined) {
  const rows: string[] = [
    `resting eyelid ${RESTING_MM.toFixed(1)} mm. The blink line is half the learned`,
    `baseline, so it climbs as the baseline ratchets. Sampled at 120 Hz, so`,
    `nothing here is a sampling effect.`,
    "",
    "baseline   blink   arm     eye reads    0.3 mm wobble    0.9 mm wobble",
    "/ resting  line    line    closed at    200 ms  700 ms   200 ms  700 ms",
    "                           rest?",
    "-".repeat(70),
  ];
  for (const ratio of [1.11, 1.41, 1.7, 1.9, 1.97, 2.05]) {
    const optics = opticsForRatio(ratio);
    const arm = armLineMm(optics, APERTURE_HYSTERESIS_FRACTION);
    const cell = (d: number, t: number) =>
      (counted(wobble(d, t), optics) ? "COUNTED" : "  -    ").padStart(8);
    rows.push(
      `  ${ratio.toFixed(2)}` +
        optics.thresholdMm.toFixed(2).padStart(8) +
        arm.toFixed(2).padStart(8) +
        (optics.thresholdMm > RESTING_MM ? "     yes " : "     no  ").padStart(
          13,
        ) +
        cell(0.3, 200) +
        cell(0.3, 700) +
        cell(0.9, 200) +
        cell(0.9, 700),
    );
  }
  rows.push(
    "",
    `A real blink against the ${String(MAX_BLINK_DURATION_MS)} ms ceiling, healthy optics,`,
    "by how long its closed phase lasts.",
    "",
    "  total   closed phase   counted?",
    "-".repeat(38),
  );
  for (const total of [200, 400, 600, 800, 1000, 1400]) {
    const blink = realBlink(total);
    rows.push(
      `  ${String(total).padStart(5)}` +
        msBelow(blink, HEALTHY, HEALTHY.thresholdMm).toFixed(0).padStart(15) +
        (counted(blink, HEALTHY) ? "   counted" : "   DISCARDED"),
    );
  }
  process.stdout.write("\n" + rows.join("\n") + "\n\n");
}

declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write: (text: string) => void };
};

describe("issue #178: what the duration ceiling actually does", () => {
  describe("side one, the cost, on a healthy baseline", () => {
    it("a real blink whose closed phase passes the ceiling is discarded", () => {
      // What today's code does, asserted rather than argued. The blink
      // is deep and unambiguous; only its slowness disqualifies it.
      //
      // 1400 ms of excursion, not 1000: the closed phase is only the
      // part below the blink line, which is well under half the whole
      // movement. A 1000 ms blink spends 421 ms closed and still
      // counts, which is itself worth knowing.
      const slow = realBlink(1400);
      expect(msBelow(slow, HEALTHY, HEALTHY.thresholdMm)).toBeGreaterThan(
        MAX_BLINK_DURATION_MS,
      );
      expect(counted(slow, HEALTHY)).toBe(false);
    });

    it("the same blink, quick enough, is counted", () => {
      const quick = realBlink(400);
      expect(msBelow(quick, HEALTHY, HEALTHY.thresholdMm)).toBeLessThan(
        MAX_BLINK_DURATION_MS,
      );
      expect(counted(quick, HEALTHY)).toBe(true);
    });
  });

  describe("side two, the noise filter, on a ratcheted baseline", () => {
    it("issue #126's 0.2 mm dip is not counted, and the CEILING is not why", () => {
      // The reconciliation's first half. On main this dip does not
      // count, which #126 credited to the ceiling. It is not the
      // ceiling: the dip never reaches the arm line that fix #114 added
      // afterwards, so its DURATION is never consulted at all. A short
      // version is refused just as flatly as a long one.
      const arm = armLineMm(RATCHETED, APERTURE_HYSTERESIS_FRACTION);
      const shallow = wobble(0.2, 200);
      expect(shallow.minMm).toBeLessThan(RATCHETED.thresholdMm);
      expect(shallow.minMm).toBeGreaterThan(arm);
      expect(msBelow(shallow, RATCHETED, RATCHETED.thresholdMm)).toBeLessThan(
        MAX_BLINK_DURATION_MS,
      );
      expect(counted(shallow, RATCHETED)).toBe(false);
      expect(counted(wobble(0.2, 700), RATCHETED)).toBe(false);
    });

    it("a deeper wobble DOES arm, and then only the ceiling stops it", () => {
      // The reconciliation's second half, and the reason #126 is still
      // right. Once a wobble is deep enough to arm, nothing but its
      // duration separates it from a blink. Short: counted, a phantom.
      // Long: discarded, and the ceiling is the only thing discarding
      // it. This is the class raising the constant would uncap.
      const arm = armLineMm(RATCHETED, APERTURE_HYSTERESIS_FRACTION);
      expect(wobble(0.9, 200).minMm).toBeLessThan(arm);
      expect(counted(wobble(0.9, 200), RATCHETED)).toBe(true);
      expect(counted(wobble(0.9, 700), RATCHETED)).toBe(false);
    });
  });

  describe("the variable that reconciles them", () => {
    it("that same wobble is invisible on a healthy baseline", () => {
      // Why the corpus replay never saw the noise class. On eight clips
      // of alert people the blink line sits far below the resting eye,
      // so a 0.9 mm wobble does not even read as closed and the ceiling
      // has nothing bad to throw away.
      expect(wobble(0.9, 200).minMm).toBeGreaterThan(HEALTHY.thresholdMm);
      expect(counted(wobble(0.9, 200), HEALTHY)).toBe(false);
      expect(counted(wobble(0.9, 700), HEALTHY)).toBe(false);
    });

    it("past a ratio of 2 the eye reads closed at rest and NOTHING completes", () => {
      // The far end, worth pinning because it is a third regime rather
      // than more of the second. The blink line is above the resting
      // eyelid, so a closure never reopens, so no blink is ever counted
      // and the ceiling is irrelevant again.
      const collapsed = opticsForRatio(2.05);
      expect(collapsed.thresholdMm).toBeGreaterThan(RESTING_MM);
      expect(counted(wobble(0.9, 200), collapsed)).toBe(false);
      expect(counted(realBlink(300), collapsed)).toBe(false);
    });
  });
});
