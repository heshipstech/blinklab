import { describe, expect, it } from "vitest";

import {
  startCameraFrameLoop,
  type VideoWithFrameCallback,
} from "../../src/io/frameLoop";

// Roadmap 13.8b, brief A2, the driver-level half of the Check: the
// camera path measures exactly once per PRESENTED frame. Before this
// row the camera was driven by requestAnimationFrame, which ticks at
// the display's pace and cannot tell a fresh photograph from the same
// one read again — row 13.8a measured what that does to the published
// velocity (docs/inference-once.txt). The proof here is structural as
// well as counted: this loop schedules through
// requestVideoFrameCallback and nothing else, so there is no display
// tick to multiply the measurement, and the fake below hands over
// frames one presentation at a time to count what comes out.

function fakeCamera(): {
  video: VideoWithFrameCallback;
  present: (nowMs: number) => void;
  pendingCount: () => number;
  cancelled: number[];
} {
  let nextHandle = 1;
  const pending = new Map<
    number,
    (now: number, metadata: { mediaTime: number }) => void
  >();
  const cancelled: number[] = [];
  const video = {
    requestVideoFrameCallback(
      callback: (now: number, metadata: { mediaTime: number }) => void,
    ): number {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);
      return handle;
    },
    cancelVideoFrameCallback(handle: number): void {
      cancelled.push(handle);
      pending.delete(handle);
    },
  };
  const present = (nowMs: number): void => {
    // One presentation resolves every registered callback exactly
    // once, the way the platform does: a callback registered after
    // this presentation waits for the next.
    const waiting = [...pending.values()];
    pending.clear();
    for (const callback of waiting) {
      // The metadata's mediaTime deliberately disagrees with the
      // callback's own timestamp, so a loop that read the wrong clock
      // would hand on a visibly different number.
      callback(nowMs, { mediaTime: nowMs / 1000 });
    }
  };
  return {
    video: video as unknown as VideoWithFrameCallback,
    present,
    pendingCount: () => pending.size,
    cancelled,
  };
}

describe("the camera driver measures once per presented frame", () => {
  it("calls onFrame exactly once per presentation, with the rVFC timestamp", () => {
    const { video, present } = fakeCamera();
    const seen: number[] = [];
    startCameraFrameLoop(
      video,
      (nowMs) => {
        seen.push(nowMs);
      },
      () => {
        throw new Error("no crash expected");
      },
    );
    const stamps = [1000, 1033.4, 1066.7, 1100, 1133.3];
    for (const stamp of stamps) present(stamp);
    // Five photographs, five measurements — and the values are the
    // callback's own timestamps, not the metadata's media clock,
    // which the fake sets to a number a thousand times smaller.
    expect(seen).toEqual(stamps);
  });

  it("a presentation with no new registration measures nothing extra", () => {
    const { video, present, pendingCount } = fakeCamera();
    let calls = 0;
    startCameraFrameLoop(
      video,
      () => {
        calls += 1;
      },
      () => {
        throw new Error("no crash expected");
      },
    );
    present(500);
    present(533);
    expect(calls).toBe(2);
    // The loop keeps exactly one registration outstanding: one
    // presentation, one callback, one re-arm.
    expect(pendingCount()).toBe(1);
  });

  it("stop() cancels the outstanding callback and ends measurement", () => {
    const { video, present, cancelled, pendingCount } = fakeCamera();
    let calls = 0;
    const loop = startCameraFrameLoop(
      video,
      () => {
        calls += 1;
      },
      () => {
        throw new Error("no crash expected");
      },
    );
    present(100);
    loop.stop();
    expect(cancelled.length).toBe(1);
    expect(pendingCount()).toBe(0);
    present(133);
    expect(calls).toBe(1);
  });

  it("a throw reports once and ends the loop for good", () => {
    const { video, present, pendingCount } = fakeCamera();
    const crashes: unknown[] = [];
    let calls = 0;
    startCameraFrameLoop(
      video,
      () => {
        calls += 1;
        if (calls === 2) throw new Error("measurement broke");
      },
      (error) => {
        crashes.push(error);
      },
    );
    present(100);
    present(133);
    // Reported once, stopped for good: the same contract as the
    // display loop's, because this loop dying silently mid-session is
    // the same frozen page with a different driver.
    expect(crashes.length).toBe(1);
    expect(crashes[0]).toBeInstanceOf(Error);
    expect(pendingCount()).toBe(0);
    present(166);
    expect(calls).toBe(2);
    expect(crashes.length).toBe(1);
  });
});
