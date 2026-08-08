import { describe, expect, it } from "vitest";

import {
  appendEvent,
  formatBlinkEvent,
  serialiseBlinkEvents,
  BLINK_CSV_COLUMNS,
  type BlinkEvent,
} from "../../src/core/blinkLog";
import { BLINK_LOG_CAP } from "../../src/core/constants";

function eventAt(atMs: number): BlinkEvent {
  return {
    atMs,
    durationMs: 133,
    shape: null,
    startFrame: null,
    endFrame: null,
  };
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
        startFrame: null,
        endFrame: null,
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

describe("serialiseBlinkEvents", () => {
  const withShape = (
    startFrame: number | null,
    endFrame: number | null,
  ): BlinkEvent => ({
    atMs: 1000,
    durationMs: 133,
    startFrame,
    endFrame,
    shape: {
      amplitudeMm: 5.2,
      peakClosingVelocityMmPerS: 110,
      amplitudeOverVelocityMs: 47,
    },
  });

  it("writes one row per blink with its frame span", () => {
    const csv = serialiseBlinkEvents([withShape(100, 108)]);
    expect(csv).not.toBeNull();
    const lines = (csv ?? "").trimEnd().split("\r\n");
    expect(lines[0]).toBe(BLINK_CSV_COLUMNS.join(","));
    expect(lines[1]).toBe("100,108,1000,133,5.2,110,47");
  });

  it("refuses a session with no blinks rather than writing a lone header", () => {
    // A header with no rows claims blinks were looked for and none
    // found, which is a different fact from no session at all. The
    // per-second exporter makes the same refusal for the same reason.
    expect(serialiseBlinkEvents([])).toBeNull();
  });

  it("writes an unanalysable shape as empty, never as zero", () => {
    // A blink whose shape could not be measured must not read as a
    // blink of zero amplitude, which is a real and very different
    // claim about somebody's eyelid.
    const csv = serialiseBlinkEvents([
      { atMs: 1000, durationMs: 133, shape: null, startFrame: 5, endFrame: 9 },
    ]);
    expect((csv ?? "").trimEnd().split("\r\n")[1]).toBe("5,9,1000,133,,,");
  });

  it("writes missing frame numbers as empty, which is what a camera has", () => {
    const csv = serialiseBlinkEvents([withShape(null, null)]);
    expect((csv ?? "").trimEnd().split("\r\n")[1]).toBe(
      ",,1000,133,5.2,110,47",
    );
  });

  it("carries the metadata block above the header", () => {
    const csv = serialiseBlinkEvents([withShape(1, 2)], ["# clip: a.mp4"]);
    expect((csv ?? "").split("\r\n")[0]).toBe("# clip: a.mp4");
  });

  it("ends every line with CRLF, including the last", () => {
    // RFC 4180, the same rule the per-second export follows.
    expect(serialiseBlinkEvents([withShape(1, 2)])).toMatch(/\r\n$/);
  });
});
