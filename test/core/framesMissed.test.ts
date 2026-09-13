import { describe, expect, it } from "vitest";
import {
  emptyFramesMissed,
  framesMissedSummary,
  notePresented,
} from "../../src/core/framesMissed";

// Feed a sequence of metadata.presentedFrames values through the reducer
// the way io/frameLoop.ts's callback would, one per fired callback.
function fold(sequence: readonly number[]) {
  return sequence.reduce(notePresented, emptyFramesMissed());
}

describe("framesMissed", () => {
  it("counts nothing before any frame callback has fired", () => {
    const summary = framesMissedSummary(emptyFramesMissed());
    expect(summary.missedWhileBusy).toBeNull();
    expect(summary.framesPresented).toBeNull();
  });

  it("misses one frame on the roadmap's own 1,2,4,5 sequence", () => {
    // gaps 1, 2, 1: the single gap of 2 skipped one presented frame.
    const summary = framesMissedSummary(fold([1, 2, 4, 5]));
    expect(summary.missedWhileBusy).toBe(1);
    // four callbacks fired over five presented frames (1 through 5).
    expect(summary.framesPresented).toBe(5);
  });

  it("misses nothing when every presented frame fired a callback", () => {
    const summary = framesMissedSummary(fold([10, 11, 12, 13]));
    expect(summary.missedWhileBusy).toBe(0);
    expect(summary.framesPresented).toBe(4);
  });

  it("counts a long stall as every skipped frame", () => {
    // one gap of 4 (1 -> 5) skipped three presented frames.
    const summary = framesMissedSummary(fold([1, 5]));
    expect(summary.missedWhileBusy).toBe(3);
    expect(summary.framesPresented).toBe(5);
  });

  it("takes the first callback as the baseline, not as three missed", () => {
    // presentedFrames is cumulative since the element began producing
    // frames, so a loop that attaches late sees a large first value and
    // must not read it as frames it was responsible for.
    const summary = framesMissedSummary(fold([100, 101, 102]));
    expect(summary.missedWhileBusy).toBe(0);
    expect(summary.framesPresented).toBe(3);
  });

  it("refuses a repeated count rather than reporting a phantom zero", () => {
    // presentedFrames must strictly advance; a repeat is the browser
    // (or a fake) violating the contract, and the measurement is refused
    // by name rather than folded in as a gap of zero.
    const summary = framesMissedSummary(fold([5, 5]));
    expect(summary.missedWhileBusy).toBeNull();
    expect(summary.framesPresented).toBeNull();
  });

  it("refuses a backwards count and never returns a negative miss", () => {
    const state = fold([5, 3]);
    expect(state.kind).toBe("refused");
    const summary = framesMissedSummary(state);
    expect(summary.missedWhileBusy).toBeNull();
  });

  it("refuses a non-integer or non-finite count", () => {
    expect(fold([1, 2.5]).kind).toBe("refused");
    expect(fold([1, Number.NaN]).kind).toBe("refused");
    expect(fold([1, Number.POSITIVE_INFINITY]).kind).toBe("refused");
    expect(notePresented(emptyFramesMissed(), -1).kind).toBe("refused");
  });

  it("stays refused once refused, ignoring later well-formed frames", () => {
    // A refusal is final: a session whose counter ever saw a bad value
    // cannot un-refuse, the same way a refused calibration stays refused.
    const refused = fold([5, 3]);
    const after = notePresented(notePresented(refused, 10), 11);
    expect(after.kind).toBe("refused");
    expect(framesMissedSummary(after).missedWhileBusy).toBeNull();
  });

  it("reports zero missed for a single observed frame", () => {
    const summary = framesMissedSummary(fold([42]));
    expect(summary.missedWhileBusy).toBe(0);
    expect(summary.framesPresented).toBe(1);
  });
});
