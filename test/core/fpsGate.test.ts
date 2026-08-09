import { describe, expect, it } from "vitest";

import {
  gatedBlinkRatePerMin,
  recordBlink,
  startRate,
} from "../../src/core/blinkRate";
import { MIN_BLINK_FPS } from "../../src/core/constants";
import {
  clipRefusedMessage,
  fpsGateMessage,
  measurableAtFps,
} from "../../src/core/fpsGate";

describe("measurableAtFps", () => {
  it("runs the boundary trio at the minimum", () => {
    expect(measurableAtFps(MIN_BLINK_FPS - 0.1)).toBe(false);
    expect(measurableAtFps(MIN_BLINK_FPS)).toBe(true);
    expect(measurableAtFps(MIN_BLINK_FPS + 0.1)).toBe(true);
  });

  it("treats an unknown fps as unmeasurable", () => {
    expect(measurableAtFps(null)).toBe(false);
  });
});

describe("the ladder's assertion: null, not zero", () => {
  it("returns null below the gate even though blinks exist", () => {
    let rate = startRate(0);
    rate = recordBlink(rate, 10000);
    rate = recordBlink(rate, 20000);
    expect(gatedBlinkRatePerMin(20, rate, 30000)).toBeNull();
    expect(gatedBlinkRatePerMin(20, rate, 30000)).not.toBe(0);
  });

  it("returns the true number at and above the gate", () => {
    let rate = startRate(0);
    rate = recordBlink(rate, 10000);
    rate = recordBlink(rate, 20000);
    expect(gatedBlinkRatePerMin(MIN_BLINK_FPS, rate, 30000)).toBeCloseTo(4, 6);
    expect(gatedBlinkRatePerMin(60, rate, 30000)).toBeCloseTo(4, 6);
  });
});

describe("fpsGateMessage", () => {
  it("stays silent while measurable", () => {
    expect(fpsGateMessage(60)).toBe("");
  });

  it("names the current fps and the minimum when refusing", () => {
    const message = fpsGateMessage(18);
    expect(message).toContain("18");
    expect(message).toContain(String(MIN_BLINK_FPS));
  });

  it("explains an unknown fps readably", () => {
    expect(fpsGateMessage(null).length).toBeGreaterThan(10);
  });
});

describe("clipRefusedMessage, a whole clip below the floor", () => {
  // THE REAL CASE. 16 of 36 DROZY sessions were recorded at 15 frames
  // per second, so blink detection never once opened on them. The batch
  // reported "36 measured, 0 failed" and produced no blink data for
  // nearly half the set. Issue #192.
  it("says a refusal is not a failure, and names the rate", () => {
    const text = clipRefusedMessage(15, 1800);
    expect(text).toContain("refusal rather than a failure");
    expect(text).toContain("15.0 frames per second");
    expect(text).toContain("1800");
  });

  it("names the floor it did not clear", () => {
    expect(clipRefusedMessage(15, 1800)).toContain(String(MIN_BLINK_FPS));
  });

  it("says the rest of the export is still good", () => {
    // Otherwise a reader throws away a file that is largely fine.
    expect(clipRefusedMessage(15, 1800)).toContain("still valid");
  });

  it("names the other measurements that ride the same gate", () => {
    // PERCLOS and long closures were silent too, and a message that
    // mentions only blinks leaves the reader hunting for those.
    const text = clipRefusedMessage(15, 1800);
    expect(text).toContain("Eye closure share");
    expect(text).toContain("long closures");
  });

  it("copes when the frame rate could not be established at all", () => {
    expect(clipRefusedMessage(null, 900)).toContain("could not be established");
  });
});
