import { describe, expect, it } from "vitest";

import { initialBlinkState } from "../../src/core/blink";
import { replayTrace, type TraceRow } from "../../src/core/blinkReplay";

// Roadmap 10.8a, the replay tool the regression run wants committed
// BEFORE the run. This is its first half: drive the REAL detector over
// a clip's committed per-frame trace and keep the state it was in at
// every frame.
//
// Why it has to exist at all. `analysis/tools/miss_autopsy.py` already
// answers what the aperture DID during a missed blink, and one of its
// four verdicts is `crossed_line`: the signal was there and, in that
// tool's own words, "the detector's own state machine (re-arm,
// refractory) swallowed it". It cannot say WHICH part swallowed it,
// because it reads the trace and not the detector.
//
// This reads the detector. The re-arm gate and the refractory window
// are two different mechanisms with two different fixes, and a run
// that reports "the state machine did it" for forty misses tells
// nobody which one to look at.
//
// The trace carries `blinkLineMm`, the EFFECTIVE line the detector
// compared against on that frame, recorded rather than reconstructed.
// So a replay is faithful rather than a second guess at what the line
// was, which is the property that makes this worth doing in TypeScript
// against `blinkStep` instead of reimplementing the reducer in Python.
// A reimplementation would be evaluating the reimplementation.

/** A frame at a fixed line, so a test reads as a shape not a table. */
function row(
  frameIndex: number,
  apertureMm: number | null,
  blinkLineMm: number | null = 3,
): TraceRow {
  return {
    frameIndex,
    // 30 frames per second, the corpus rate, so a frame is 33.3 ms.
    mediaTimeSeconds: frameIndex / 30,
    apertureMm,
    blinkLineMm,
  };
}

describe("replaying a trace through the real detector", () => {
  it("returns one entry per trace row, in order", () => {
    const replayed = replayTrace([row(0, 5), row(1, 5), row(2, 5)]);
    expect(replayed.map((entry) => entry.frameIndex)).toEqual([0, 1, 2]);
  });

  it("starts from the detector's own initial state", () => {
    const replayed = replayTrace([row(0, 5)]);
    expect(replayed[0]?.before).toEqual(initialBlinkState);
  });

  it("says nothing about an empty trace rather than inventing a frame", () => {
    expect(replayTrace([])).toEqual([]);
  });

  it("counts a blink the detector would count", () => {
    // Open, a closure deep enough to arm, then open again. The line is
    // 3 mm, so arming needs 2.7 or below.
    const rows = [
      row(0, 5),
      row(1, 5),
      row(2, 2.0),
      row(3, 2.0),
      row(4, 5),
      row(5, 5),
    ];
    const replayed = replayTrace(rows);
    expect(replayed[replayed.length - 1]?.after.blinkCount).toBe(1);
  });

  it("carries the state before and after each frame, not just after", () => {
    // The before state is the whole point: a miss is explained by what
    // the detector was holding when the aperture crossed, and the
    // after state has already been changed by that crossing.
    const replayed = replayTrace([row(0, 5), row(1, 2.0)]);
    expect(replayed[1]?.before.eye).toBe("open");
    expect(replayed[1]?.after.eye).toBe("closed");
  });

  it("keeps the re-arm flag, which is the question this exists for", () => {
    // A counted blink shuts the gate. Until the lid clears the line by
    // the hysteresis gap (3.3 mm here), no new closure may arm — which
    // is exactly the mechanism that turned one volunteer's blink into
    // 25 counts before it existed, and which now has to be told apart
    // from the refractory window.
    const rows = [
      row(0, 5),
      row(1, 2.0),
      row(2, 2.0),
      // Reopens only to 3.1: above the line, below the re-arm line.
      row(3, 3.1),
      row(4, 3.1),
    ];
    const replayed = replayTrace(rows);
    const last = replayed[replayed.length - 1];
    expect(last?.after.blinkCount).toBe(1);
    expect(last?.after.rearmed).toBe(false);
  });

  it("opens the gate again once the lid clears the re-arm line", () => {
    const rows = [row(0, 5), row(1, 2.0), row(2, 2.0), row(3, 5)];
    const replayed = replayTrace(rows);
    expect(replayed[replayed.length - 1]?.after.rearmed).toBe(true);
  });

  it("treats a frame with no line as a frame the detector was not fed", () => {
    // `blinkLineMm` is null when the detector was fed nothing on that
    // frame. Passing a made-up line would put the replay somewhere the
    // detector never was.
    const replayed = replayTrace([row(0, 5), row(1, 2.0, null), row(2, 5)]);
    expect(replayed[1]?.after.eye).toBe("unknown");
  });

  it("treats a frame with no aperture the same way", () => {
    const replayed = replayTrace([row(0, 5), row(1, null), row(2, 5)]);
    expect(replayed[1]?.after.eye).toBe("unknown");
  });

  it("uses the clip's own clock, not a frame counter", () => {
    // The refractory window and every duration are in milliseconds off
    // the clip's clock. A replay that counted frames would measure a
    // different quantity on a clip at a different rate.
    const replayed = replayTrace([row(0, 5), row(30, 5)]);
    expect(replayed[1]?.nowMs).toBeCloseTo(1000, 6);
  });

  it("refuses a trace whose frames go backwards", () => {
    // The detector ignores a backwards frame, so a replay over one
    // would silently measure a different clip from the one recorded.
    // A corpus trace is written in order; out of order is a defect
    // upstream and is worth stopping for rather than absorbing.
    expect(() => replayTrace([row(2, 5), row(1, 5)])).toThrow(/order/i);
  });
});
