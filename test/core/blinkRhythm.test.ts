import { describe, expect, it } from "vitest";

import {
  MIN_BLINKS_FOR_RHYTHM,
  interBlinkIntervalsMs,
  intervalIrregularity,
} from "../../src/core/blinkRhythm";

// Roadmap 12.9. How REGULARLY somebody blinks, as distinct from how
// often. Two people can blink fifteen times a minute and one of them
// metronomically while the other goes quiet and then flurries, and
// blink rate cannot tell them apart.
//
// The measure is the coefficient of variation of the gaps between
// blinks: the spread of those gaps over their mean. It is scale-free
// by construction, which is the property the third test pins, and it
// is the reason a ratio was chosen over a spread in milliseconds — a
// spread of 200 ms means something different to somebody blinking
// every second and somebody blinking every ten.

/** Onsets at a fixed spacing: the perfectly regular blinker. */
function regular(count: number, gapMs: number, startMs = 0): number[] {
  return Array.from({ length: count }, (_, n) => startMs + n * gapMs);
}

describe("the gaps between blinks", () => {
  it("takes one interval fewer than there are blinks", () => {
    expect(interBlinkIntervalsMs([0, 100, 300])).toEqual([100, 200]);
  });

  it("has no interval at all from a single blink", () => {
    expect(interBlinkIntervalsMs([0])).toEqual([]);
    expect(interBlinkIntervalsMs([])).toEqual([]);
  });

  it("refuses onsets that do not move forward", () => {
    // A blink log whose times go backwards, or repeat, is a defect
    // upstream rather than a person who blinked twice at once. A
    // negative gap would quietly shrink the mean and inflate the
    // ratio, which is a wrong number that looks ordinary.
    expect(() => interBlinkIntervalsMs([0, 300, 200])).toThrow(/forward/);
    expect(() => interBlinkIntervalsMs([0, 100, 100])).toThrow(/forward/);
  });
});

describe("the irregularity itself", () => {
  it("is zero for a metronome", () => {
    expect(intervalIrregularity(regular(20, 4000))).toBe(0);
  });

  it("recovers a known coefficient of variation", () => {
    // Gaps alternating 3000 and 5000 ms: mean 4000, population
    // standard deviation 1000, so the ratio is exactly 0.25.
    const onsets = [0];
    for (let n = 0; n < 20; n += 1) {
      onsets.push((onsets.at(-1) ?? 0) + (n % 2 === 0 ? 3000 : 5000));
    }
    expect(intervalIrregularity(onsets)).toBeCloseTo(0.25, 10);
  });

  it("is unchanged when every time is scaled by the same factor", () => {
    // The property that makes a ratio the right shape here. Somebody
    // blinking every ten seconds with the same relative raggedness as
    // somebody blinking every second scores the same, which a spread
    // in milliseconds could not do.
    const onsets = [
      0, 900, 2400, 3100, 5000, 5400, 7200, 7500, 9000, 9400, 11000, 11600,
      13000, 13400, 15000, 15900,
    ];
    const stretched = onsets.map((t) => t * 7.5);
    const one = intervalIrregularity(onsets);
    const other = intervalIrregularity(stretched);
    expect(one).not.toBeNull();
    expect(other).toBeCloseTo(one as number, 10);
  });
});

describe("the floor, which is a refusal and not a zero", () => {
  it("says nothing below the minimum number of blinks", () => {
    expect(
      intervalIrregularity(regular(MIN_BLINKS_FOR_RHYTHM - 1, 4000)),
    ).toBeNull();
  });

  it("answers at exactly the minimum", () => {
    // The boundary is pinned on both sides, because a floor tested
    // only from below is a floor nobody knows the position of.
    expect(intervalIrregularity(regular(MIN_BLINKS_FOR_RHYTHM, 4000))).toBe(0);
  });

  it("is fifteen blinks, which is fourteen gaps", () => {
    expect(MIN_BLINKS_FOR_RHYTHM).toBe(15);
  });

  it("refuses fourteen and answers fifteen, by the literal numbers", () => {
    // Written as 14 and 15 rather than from the constant on purpose.
    // Every other case here derives its probe from
    // MIN_BLINKS_FOR_RHYTHM, so moving the constant moves the probe
    // with it and the boundary tests keep passing at the new
    // position — a floor tested only through its own constant is a
    // floor nothing holds in place. Roadmap 10.1c learned this.
    expect(intervalIrregularity(regular(14, 4000))).toBeNull();
    expect(intervalIrregularity(regular(15, 4000))).toBe(0);
  });
});
