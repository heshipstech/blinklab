import { describe, expect, it } from "vitest";

import {
  appendEvent,
  formatBlinkEvent,
  type BlinkEvent,
} from "../../src/core/blinkLog";
import { BLINK_LOG_CAP } from "../../src/core/constants";

function eventAt(atMs: number): BlinkEvent {
  return { atMs, durationMs: 133, shape: null };
}

describe("appendEvent, the event reducer", () => {
  it("appends in arrival order below the cap", () => {
    const events = appendEvent(appendEvent([], eventAt(1000)), eventAt(2000));
    expect(events.map((e) => e.atMs)).toEqual([1000, 2000]);
  });

  it("holds exactly the cap, then drops the oldest", () => {
    let events: BlinkEvent[] = [];
    for (let i = 0; i < BLINK_LOG_CAP; i++) {
      events = appendEvent(events, eventAt(i));
    }
    expect(events.length).toBe(BLINK_LOG_CAP);
    events = appendEvent(events, eventAt(999999));
    expect(events.length).toBe(BLINK_LOG_CAP);
    expect(events[0]?.atMs).toBe(1);
    expect(events[events.length - 1]?.atMs).toBe(999999);
  });
});

describe("formatBlinkEvent", () => {
  it("renders time relative to the session start, duration and shape", () => {
    const line = formatBlinkEvent(
      {
        atMs: 52340,
        durationMs: 133,
        shape: {
          amplitudeMm: 5.23,
          peakClosingVelocityMmPerS: 68.4,
          amplitudeOverVelocityMs: 76.5,
        },
      },
      10000,
    );
    expect(line).toContain("42.3 s");
    expect(line).toContain("133 ms");
    expect(line).toContain("5.2 mm");
    expect(line).toContain("68 mm/s");
  });

  it("stays readable when the shape analysis produced nothing", () => {
    const line = formatBlinkEvent(eventAt(11000), 10000);
    expect(line).toContain("1.0 s");
    expect(line).toContain("133 ms");
    expect(line).toContain("shape unavailable");
  });
});
