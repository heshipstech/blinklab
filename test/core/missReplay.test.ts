import { describe, expect, it } from "vitest";

import { missFacts } from "../../src/core/blinkReplay";
import type { MissSpan, TraceRow } from "../../src/core/blinkReplay";

// Roadmap 10.8a2, the replay tool's per-miss half. The three
// quantities row 10.8a names, for each blink a human marked and the
// detector did not count.
//
// The question they answer together. `miss_autopsy.py` can already say
// the aperture crossed the line and no blink was logged — its
// `crossed_line` verdict, which in its own words means "the detector's
// own state machine (re-arm, refractory) swallowed it". Two mechanisms,
// one verdict, and they have different fixes:
//
//   the RE-ARM GATE shuts after a counted blink and stays shut until
//   the lid clears the line by the hysteresis gap. A lid that hovers
//   in that band has its next closures suppressed. This is the gate
//   added on 20 August after one volunteer was counted 25 times for
//   10 blinks, and its cost was accepted in writing beforehand.
//
//   the REFRACTORY WINDOW drops a closure finishing within 150 ms of
//   the last counted blink, as the tail of that blink rather than a
//   new one.
//
// `rearmedAtCrossing` separates them directly, and the two spans say
// by how much in each case.
//
// NO VERDICT COLUMN, deliberately, and the roadmap row says so. Naming
// which mechanism swallowed a miss is a conclusion about data that does
// not exist yet; this ships the measurements and a later row scored
// against the run draws the line.

function row(
  frameIndex: number,
  apertureMm: number | null,
  blinkLineMm: number | null = 3,
): TraceRow {
  return {
    frameIndex,
    mediaTimeSeconds: frameIndex / 30,
    apertureMm,
    blinkLineMm,
  };
}

/** A miss the human marked over the given frames. */
function miss(startFrame: number, endFrame: number): MissSpan {
  return { blinkId: `b${String(startFrame)}`, startFrame, endFrame };
}

describe("the three quantities, per miss", () => {
  it("says nothing when there are no misses", () => {
    expect(missFacts([row(0, 5)], [])).toEqual([]);
  });

  it("finds the frame the aperture crossed the line", () => {
    const rows = [row(0, 5), row(1, 5), row(2, 2.5), row(3, 2.5), row(4, 5)];
    const [fact] = missFacts(rows, [miss(1, 4)]);
    expect(fact?.crossingFrame).toBe(2);
  });

  it("reports no crossing when the aperture never dipped", () => {
    // The autopsy's `above_line` population. The detector was never
    // given anything to suppress, so the state-machine quantities are
    // not applicable rather than zero.
    const rows = [row(0, 5), row(1, 4.9), row(2, 4.8), row(3, 5)];
    const [fact] = missFacts(rows, [miss(1, 3)]);
    expect(fact?.crossingFrame).toBeNull();
    expect(fact?.rearmedAtCrossing).toBeNull();
    expect(fact?.msSincePreviousBlink).toBeNull();
    expect(fact?.crossingToReopenMs).toBeNull();
  });

  it("looks for the crossing only inside the marked span", () => {
    // A dip before the human's span belongs to a different blink. The
    // autopsy scopes to the annotation's own frames and this matches
    // it, so the two tables join row for row.
    const rows = [row(0, 2.0), row(1, 5), row(2, 5), row(3, 5)];
    const [fact] = missFacts(rows, [miss(2, 3)]);
    expect(fact?.crossingFrame).toBeNull();
  });

  it("follows the reopening PAST the marked span, because a lid does", () => {
    // The span is the human's judgement of the blink. The lid clearing
    // the re-arm line is the detector's business and routinely happens
    // after it. Stopping at endFrame would report "never reopened" for
    // an eye that plainly did.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      row(3, 3.1),
      row(4, 3.1),
      row(5, 5),
    ];
    const [fact] = missFacts(rows, [miss(1, 2)]);
    expect(fact?.reopenFrame).toBe(5);
  });

  it("measures the crossing-to-reopen span on the clip's clock", () => {
    // Frames 1 to 5 at 30 fps is 4 frames, 133.3 ms. Milliseconds
    // rather than frames, because the thresholds it is compared
    // against are in milliseconds and a clip at another rate would
    // otherwise report a different quantity under the same name.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      row(3, 3.1),
      row(4, 3.1),
      row(5, 5),
    ];
    const [fact] = missFacts(rows, [miss(1, 2)]);
    expect(fact?.crossingToReopenMs).toBeCloseTo(133.33, 1);
  });

  it("leaves the span open when the trace ends before the lid clears", () => {
    // A clip that ends mid-closure, or a lid still inside the band at
    // the last frame. Reporting the trace's end as a reopening would
    // invent an event.
    const rows = [row(0, 5), row(1, 2.0), row(2, 3.1), row(3, 3.1)];
    const [fact] = missFacts(rows, [miss(1, 2)]);
    expect(fact?.reopenFrame).toBeNull();
    expect(fact?.crossingToReopenMs).toBeNull();
  });

  it("reports the re-arm flag the detector held at the crossing", () => {
    // The first closure counts and shuts the gate. The lid reopens
    // only to 3.1, inside the band, so the second closure arrives with
    // the gate still shut and is not counted. That second closure is
    // the miss, and this is the quantity that names why.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      row(3, 3.1),
      row(4, 2.0),
      row(5, 2.0),
      row(6, 3.1),
    ];
    const [fact] = missFacts(rows, [miss(4, 5)]);
    expect(fact?.crossingFrame).toBe(4);
    expect(fact?.rearmedAtCrossing).toBe(false);
  });

  it("reports the gate OPEN for a miss the gate did not cause", () => {
    // So the flag cannot be read as "always false on a miss". Here the
    // lid clears the re-arm line between the two closures, and the
    // second is missed for a different reason entirely.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      row(3, 5),
      row(4, 2.0),
      row(5, 2.0),
      row(6, 5),
    ];
    const [fact] = missFacts(rows, [miss(4, 5)]);
    expect(fact?.rearmedAtCrossing).toBe(true);
  });

  it("measures the distance from the previous counted blink", () => {
    // The refractory window's own quantity, measured where the
    // detector tests it: at the frame the closure COMPLETES, not at
    // the crossing. `blinkStep`'s refractory comparison lives in the
    // OPEN branch, so a distance read at the crossing is a different
    // quantity wearing the same units and cannot be compared to the
    // 150 ms constant.
    //
    // First blink ends at frame 3. The second closure crosses at 4 and
    // completes at 6: 3 frames, 100 ms.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      row(3, 5),
      row(4, 2.0),
      row(5, 2.0),
      row(6, 5),
    ];
    const [fact] = missFacts(rows, [miss(4, 5)]);
    expect(fact?.msSincePreviousBlink).toBeCloseTo(100, 1);
  });

  it("reads the distance where blinkStep does, not at the crossing", () => {
    // The two readings differ, and only one is comparable to
    // BLINK_REFRACTORY_MS. Pinned so the measurement point cannot
    // drift back to the crossing without this going red.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      row(3, 5),
      row(4, 2.0),
      row(5, 2.0),
      row(6, 5),
    ];
    const [fact] = missFacts(rows, [miss(4, 5)]);
    // At the crossing this would read 33.3 ms; at completion, 100 ms.
    expect(fact?.msSincePreviousBlink).not.toBeCloseTo(33.33, 1);
  });

  it("reports no distance before the first counted blink", () => {
    // Null is a refusal, not a zero: nothing has happened to measure
    // from, and a zero here would read as "immediately after a blink",
    // which is the opposite of the truth.
    const rows = [row(0, 5), row(1, 2.0), row(2, 2.0), row(3, 5)];
    const [fact] = missFacts(rows, [miss(1, 2)]);
    expect(fact?.msSincePreviousBlink).toBeNull();
  });

  it("anchors on the closure that ARMED, not the first dip in the span", () => {
    // Found by an adversarial review, and it is the failure this whole
    // tool exists to avoid: a plausible number attributed to the wrong
    // event.
    //
    // A shallow wobble crosses the line at frame 3 and comes back at
    // frame 4 without ever reaching arm depth, so the detector treats
    // it as nothing. The real dip follows at frame 5, arms, and
    // completes at frame 6 — and THAT is the closure the refractory
    // window judged, at 133.3 ms from the previous count.
    //
    // Anchoring on the first crossing reported 66.7 ms: a real
    // measurement of a closure the detector never evaluated. Both
    // numbers look entirely ordinary in a table, and a lid that
    // wobbles before it blinks is exactly the behaviour the re-arm
    // gate was added for, so this is not a contrived trace.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 5),
      // The wobble: below the 3 mm line, never below the 2.7 arm line.
      row(3, 2.9),
      row(4, 3.05),
      // The real closure.
      row(5, 2.0),
      row(6, 3.1),
    ];
    const [fact] = missFacts(rows, [miss(3, 6)]);
    expect(fact?.crossingFrame).toBe(5);
    expect(fact?.msSincePreviousBlink).toBeCloseTo(133.33, 1);
  });

  it("falls back to the first crossing when nothing in the span armed", () => {
    // A span whose every dip stayed above arm depth. There is no armed
    // closure to anchor on, and that IS the answer: the quantities
    // describe a closure that never got close enough to count.
    const rows = [row(0, 5), row(1, 2.9), row(2, 2.95), row(3, 5)];
    const [fact] = missFacts(rows, [miss(1, 2)]);
    expect(fact?.crossingFrame).toBe(1);
  });

  it("carries the miss's identity through, so tables can be joined", () => {
    const [fact] = missFacts([row(0, 5), row(1, 2.0)], [miss(1, 1)]);
    expect(fact?.blinkId).toBe("b1");
    expect(fact?.startFrame).toBe(1);
    expect(fact?.endFrame).toBe(1);
  });

  it("returns a fact per miss, in the order given", () => {
    const rows = [row(0, 5), row(1, 2.0), row(2, 5), row(3, 2.0), row(4, 5)];
    expect(
      missFacts(rows, [miss(3, 3), miss(1, 1)]).map((f) => f.blinkId),
    ).toEqual(["b3", "b1"]);
  });

  it("names no mechanism, which is the point", () => {
    // Pinned as a property of the shape rather than left to review. A
    // verdict column added later without a scored prediction behind it
    // turns this table into an answer nobody measured.
    const [fact] = missFacts([row(0, 5), row(1, 2.0)], [miss(1, 1)]);
    expect(Object.keys(fact ?? {})).toEqual([
      "blinkId",
      "startFrame",
      "endFrame",
      "crossingFrame",
      "reopenFrame",
      "crossingToReopenMs",
      "msSincePreviousBlink",
      "rearmedAtCrossing",
    ]);
  });
});
