import { describe, expect, it } from "vitest";

import type { LandmarkerLoad } from "../../src/io/landmarker";
import { reacquireLandmarker } from "../../src/io/faceReacquire";

// Roadmap 13.13's io half, driven by the fake-landmarker harness the
// owner accepted as the lost-face event's stand-in: a wedged instance
// is left behind and a fresh one loaded — the re-attempt — and every
// failure path keeps the session alive, because a run that lost its
// face must never ALSO lose its page to the recovery.

type FakeLandmarker = { close: () => void };

function fakeLoad(landmarker: FakeLandmarker): () => Promise<LandmarkerLoad> {
  return () =>
    Promise.resolve({
      landmarker,
      requestedDelegate: "GPU",
      gpuLoadRejected: false,
    } as unknown as LandmarkerLoad);
}

describe("re-attempting acquisition instead of coasting", () => {
  it("closes the wedged instance and returns the fresh one", async () => {
    const closed: string[] = [];
    const wedged = { close: () => closed.push("old") };
    const fresh = { close: () => closed.push("new") };
    const result = await reacquireLandmarker(wedged as never, fakeLoad(fresh));
    expect(closed).toEqual(["old"]);
    expect(result).toBe(fresh);
  });

  it("a close that throws is left behind anyway", async () => {
    // A wedged instance may refuse even to die; the point of the
    // reset is to walk away from it, not to win an argument with it.
    const wedged = {
      close: () => {
        throw new Error("wedged");
      },
    };
    const fresh = { close: () => undefined };
    const result = await reacquireLandmarker(wedged as never, fakeLoad(fresh));
    expect(result).toBe(fresh);
  });

  it("a failed load returns null rather than throwing", async () => {
    // The session keeps its honest no-face state; the next signal
    // will try again. A recovery that can crash the page is worse
    // than the defect it recovers from.
    const wedged = { close: () => undefined };
    const result = await reacquireLandmarker(wedged as never, () =>
      Promise.reject(new Error("download died")),
    );
    expect(result).toBeNull();
  });

  it("a null current instance still loads a fresh one", async () => {
    const fresh = { close: () => undefined };
    const result = await reacquireLandmarker(null, fakeLoad(fresh));
    expect(result).toBe(fresh);
  });
});
