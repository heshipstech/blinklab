import { describe, expect, it } from "vitest";

import {
  gatedBlinkRatePerMin,
  recordBlink,
  startRate,
} from "../../src/core/blinkRate";
import { MIN_BLINK_FPS } from "../../src/core/constants";
import { fpsGateMessage, measurableAtFps } from "../../src/core/fpsGate";

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
