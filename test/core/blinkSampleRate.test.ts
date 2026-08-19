import { describe, expect, it } from "vitest";

import {
  APERTURE_HYSTERESIS_FRACTION,
  BASELINE_THRESHOLD_FRACTION,
} from "../../src/core/constants";
import {
  armLineMm,
  apertureAt,
  detectionRate,
  msBelow,
  type Blink,
  type Optics,
} from "../fixtures/blinkTrace";

// Does the rate the page happens to run at change how many blinks it
// finds?
//
// The dry run of 16 and 17 August could not answer that. Three devices
// gave 7, 9 and 10 of ten deliberate blinks at 30.7, 29.2 and 126.7
// frames per second, but device, browser engine, camera, orientation
// and mounting all moved together and nothing separated them.
//
// `blinkStep` is a pure function of one aperture sample, one timestamp
// and one threshold, so the question can be asked with no camera and no
// people. Build a blink as an aperture trace, sample it at a chosen
// rate, and sweep the PHASE across a whole sample period: where the
// samples happen to land relative to the blink is the only thing that
// differs, and in a real session it is not controlled by anyone.
//
// The suspected mechanism is the arm line rather than the threshold.
// A closure enters `closed` below the threshold, but only counts once a
// sample reaches the threshold MINUS the hysteresis gap (fix #114,
// which stopped noise riding the line from minting phantom blinks). The
// trace spends far less time below the arm line than below the
// threshold, so that is the window a sample has to hit.

/**
 * The owner's own measured session `macbookair2`, so the numbers are
 * real. Named rather than labelled: `P1` to `P6` are positional and
 * this session was P4 when the file was written and became P5 the
 * moment a sixth dry-run session arrived.
 */
const BASELINE_MM = 7.78;
const OPTICS: Optics = {
  openMm: 7.0,
  thresholdMm: BASELINE_MM * BASELINE_THRESHOLD_FRACTION,
};
const THRESHOLD_MM = OPTICS.thresholdMm;
const ARM_MM = armLineMm(OPTICS, APERTURE_HYSTERESIS_FRACTION);
const OPEN_MM = OPTICS.openMm;

const RATES = [25, 30, 40, 60, 90, 120];

// The table is printed only when asked for, so `npm test` stays quiet
// and the numbers in docs/blink-sample-rate.txt still come from a real
// run. Declared locally rather than pulling in @types/node for one
// lookup in one file.
declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write: (text: string) => void };
};

// A firm blink, well past the arm line, used as the control.
const DEEP: Blink = { minMm: 1.5, closeMs: 60, openMs: 120 };

if (process.env.BLINKLAB_PRINT_TABLE !== undefined) {
  const rows: string[] = [];
  rows.push(
    `open ${OPEN_MM.toFixed(1)} mm, threshold ${THRESHOLD_MM.toFixed(2)} mm, arm line ${ARM_MM.toFixed(2)} mm`,
    "",
    "Share of phase offsets at which one blink is counted.",
    "A 150 ms blink (50 ms down, 100 ms up), swept by how deep it goes.",
    "",
    "  min     ms below   ms below   " +
      RATES.map((r) => `${String(r)} Hz`.padStart(7)).join(""),
    "  (mm)    threshold  arm line   " +
      RATES.map(() => "".padStart(7)).join(""),
    "-".repeat(29 + RATES.length * 7),
  );
  for (let min = 3.7; min >= 2.3; min -= 0.1) {
    const blink: Blink = { minMm: min, closeMs: 50, openMs: 100 };
    rows.push(
      `  ${min.toFixed(2)}` +
        msBelow(blink, OPTICS, THRESHOLD_MM).toFixed(0).padStart(11) +
        msBelow(blink, OPTICS, ARM_MM).toFixed(0).padStart(11) +
        "   " +
        RATES.map((r) =>
          detectionRate(blink, OPTICS, r).toFixed(2).padStart(7),
        ).join(""),
    );
  }
  rows.push(
    "",
    "The same question against SPEED, at a fixed depth of 3.20 mm, which",
    "is 0.30 mm below the arm line. A quicker blink spends less time down",
    "there, so it is harder to sample.",
    "",
    "  total    ms below   " +
      RATES.map((r) => `${String(r)} Hz`.padStart(7)).join(""),
    "  (ms)     arm line   " + RATES.map(() => "".padStart(7)).join(""),
    "-".repeat(21 + RATES.length * 7),
  );
  for (const total of [80, 100, 120, 150, 200, 250, 300]) {
    const blink: Blink = {
      minMm: 3.2,
      closeMs: Math.round(total / 3),
      openMs: total - Math.round(total / 3),
    };
    rows.push(
      `  ${String(total).padStart(4)}` +
        msBelow(blink, OPTICS, ARM_MM).toFixed(0).padStart(12) +
        "   " +
        RATES.map((r) =>
          detectionRate(blink, OPTICS, r).toFixed(2).padStart(7),
        ).join(""),
    );
  }
  process.stdout.write("\n" + rows.join("\n") + "\n\n");
}

describe("what the sampling rate does to blink detection", () => {
  it("a deep blink is caught at every rate and every phase", () => {
    // The reassuring half. Nothing here is broken for a firm blink.
    for (const rate of RATES) {
      expect(detectionRate(DEEP, OPTICS, rate)).toBe(1);
    }
  });

  it("a blink that never reaches the arm line is never caught, at any rate", () => {
    // Not a sampling problem at all, and the floor the rest sits on.
    // This one crosses the threshold, so the eye reads as closed, and
    // never reaches the depth that arms it, so no rate on earth counts
    // it. More frames cannot fix a blink that is too shallow.
    const tooShallow: Blink = {
      minMm: ARM_MM + 0.05,
      closeMs: 50,
      openMs: 100,
    };
    expect(apertureAt(tooShallow, OPTICS, 50)).toBeLessThan(THRESHOLD_MM);
    for (const rate of RATES) {
      expect(detectionRate(tooShallow, OPTICS, rate)).toBe(0);
    }
  });

  it("between those two there is a band where the RATE decides", () => {
    // The finding. A blink 0.2 mm below the arm line is a coin toss at
    // the rate a four core machine produces, and a certainty at the
    // rate a twelve core machine produces. Nothing about the person
    // changed; only where the samples happened to land.
    const marginal: Blink = { minMm: 3.3, closeMs: 50, openMs: 100 };
    expect(detectionRate(marginal, OPTICS, 30)).toBeLessThan(0.75);
    expect(detectionRate(marginal, OPTICS, 25)).toBeLessThan(0.65);
    expect(detectionRate(marginal, OPTICS, 90)).toBe(1);
    expect(detectionRate(marginal, OPTICS, 120)).toBe(1);
  });

  it("a QUICK blink is the vulnerable one, at the same depth", () => {
    // Depth is not the only axis. Held at one depth inside the band, an
    // 80 ms blink is missed more than half the time at 30 Hz and never
    // missed at 90. The dry run's phone reported the shortest blinks of
    // the three devices and missed the most of them.
    const quick: Blink = { minMm: 3.2, closeMs: 27, openMs: 53 };
    const slow: Blink = { minMm: 3.2, closeMs: 83, openMs: 167 };
    expect(detectionRate(quick, OPTICS, 30)).toBeLessThan(0.5);
    expect(detectionRate(quick, OPTICS, 90)).toBe(1);
    expect(detectionRate(slow, OPTICS, 30)).toBe(1);
  });

  it("more frames never make detection worse", () => {
    // The direction has to hold, or the band above is noise rather than
    // a rate effect. Checked across the whole marginal range.
    for (let min = 3.5; min >= 2.4; min -= 0.1) {
      const blink: Blink = { minMm: min, closeMs: 50, openMs: 100 };
      let previous = -1;
      for (const rate of RATES) {
        const rate_ = detectionRate(blink, OPTICS, rate);
        expect(rate_).toBeGreaterThanOrEqual(previous);
        previous = rate_;
      }
    }
  });
});
