import { describe, expect, it } from "vitest";

import { MAX_BLINK_DURATION_MS } from "../../src/core/constants";
import { detectFixations, type GazeSample } from "../../src/core/fixation";
import {
  GAZE_GAP_BRIDGE_MS,
  gapClearsGazeBuffer,
  offsetAboveBlinkLine,
} from "../../src/core/gazeBlinkGate";

// Roadmap 14.9b: blinks out of the gaze chain. During a blink the
// iris is occluded and the landmark model's iris centre dives, so a
// mid-blink "gaze offset" is a fake glance; and the page's current
// rule clears the fixation buffer on ANY gap, so every blink splits
// a real fixation in two. The two rules here fix both: the offset is
// nulled below the blink line (a blink is not a gaze measurement),
// and a blink-length null gap bridges the buffer while a longer one
// — a lost face — still clears it.

function steady(fromMs: number, toMs: number, stepMs: number): GazeSample[] {
  const samples: GazeSample[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    // Jitter well inside the dispersion box, deterministic.
    const wiggle = (t % 100 === 0 ? 1 : -1) * 0.002;
    samples.push({
      timestampMs: t,
      offset: { horizontal: 0.1 + wiggle, vertical: 0.1 - wiggle },
    });
  }
  return samples;
}

describe("the offset below the blink line (roadmap 14.9b)", () => {
  const offset = { horizontal: 0.1, vertical: -0.05 };

  it("passes above the line, untouched", () => {
    expect(offsetAboveBlinkLine(offset, 6.0, 3.5)).toBe(offset);
  });

  it("nulls below the line: a covered iris is not a gaze measurement", () => {
    expect(offsetAboveBlinkLine(offset, 3.4, 3.5)).toBeNull();
  });

  it("exactly at the line passes, the blink detector's own boundary", () => {
    // blink.ts counts closed as apertureMm < thresholdMm, strictly:
    // AT the line the eye is open by the detector's convention, and
    // this gate may not disagree with the detector about a boundary.
    expect(offsetAboveBlinkLine(offset, 3.5, 3.5)).toBe(offset);
  });

  it("a null offset stays null", () => {
    expect(offsetAboveBlinkLine(null, 6.0, 3.5)).toBeNull();
  });

  it("an unmeasured aperture keeps the offset rather than inventing a blink", () => {
    expect(offsetAboveBlinkLine(offset, null, 3.5)).toBe(offset);
  });

  it("no blink line keeps the offset: nothing to compare against", () => {
    expect(offsetAboveBlinkLine(offset, 3.4, null)).toBe(offset);
  });
});

describe("the gap that bridges and the gap that clears", () => {
  it("aliases the codebase's own blink-length bound, not an invented one", () => {
    // The long-closure detector already draws this exact line twice:
    // past MAX_BLINK_DURATION_MS a closure is no longer a blink.
    expect(GAZE_GAP_BRIDGE_MS).toBe(MAX_BLINK_DURATION_MS);
  });

  it("a blink-length gap bridges, exactly at the bound included", () => {
    expect(gapClearsGazeBuffer(GAZE_GAP_BRIDGE_MS)).toBe(false);
    expect(gapClearsGazeBuffer(200)).toBe(false);
  });

  it("a longer gap clears: bridging a lost face would invent stillness", () => {
    expect(gapClearsGazeBuffer(GAZE_GAP_BRIDGE_MS + 1)).toBe(true);
    expect(gapClearsGazeBuffer(10_000)).toBe(true);
  });
});

describe("the row's fixture: one fewer fixation per blink than today", () => {
  // One steady 2.4 s gaze with two blink-length holes in it. The eye
  // never moved; only the lid did.
  const first = steady(0, 700, 50);
  const second = steady(1000, 1600, 50);
  const third = steady(1900, 2400, 50);
  const bridged = [...first, ...second, ...third];

  it("bridged, the stillness is one fixation whatever the lid did", () => {
    const fixations = detectFixations(bridged);
    expect(fixations).toHaveLength(1);
    expect(fixations[0]?.startMs).toBe(0);
    expect(fixations[0]?.endMs).toBe(2400);
  });

  it("cleared at every gap — today's rule — the same eye reads as three", () => {
    // Today main.ts empties the buffer on any null, so each steady
    // stretch is detected alone: three fixations where the eye held
    // one. Two blinks, two invented extras — one fewer per blink is
    // exactly what bridging recovers, the row's own Check clause.
    const split = [first, second, third].flatMap((segment) =>
      detectFixations(segment),
    );
    expect(split).toHaveLength(3);
    expect(detectFixations(bridged)).toHaveLength(split.length - 2);
  });

  it("the gaps in the fixture are genuinely blink-length, the bridge rule's own bound", () => {
    // 700 -> 1000 and 1600 -> 1900: 300 ms holes, blinks by the
    // bound, so the fixture exercises the rule it claims to.
    expect(gapClearsGazeBuffer(1000 - 700)).toBe(false);
    expect(gapClearsGazeBuffer(1900 - 1600)).toBe(false);
  });
});
