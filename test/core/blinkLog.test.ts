import { describe, expect, it } from "vitest";

import {
  appendEvent,
  eventsForDisplay,
  BLINK_TABLE_HEADERS,
  blinkTableRow,
  serialiseBlinkEvents,
  BLINK_CSV_COLUMNS,
  type BlinkEvent,
} from "../../src/core/blinkLog";
import {
  BLINK_LOG_DISPLAY_CAP,
  BLINK_LOG_RECORD_CAP,
} from "../../src/core/constants";

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

  // The regression. This is the defect that cost the first external
  // validation 63 rows of its record: a session past the DISPLAY cap
  // kept only its most recent fifty blinks, and the export inherited
  // that. THREE Eyeblink8 clips made more than fifty detections, so
  // their opening stretches were deleted before the file was written.
  // 54 of the 63 deleted rows were real blinks, and those missing rows
  // read as a detector that had failed to find them.
  //
  // Written against the display cap rather than a literal 50, so it
  // keeps testing the right thing if that number is ever tuned.
  it("keeps every blink past the display cap, the 63 dropped row bug", () => {
    let events: BlinkEvent[] = [];
    const past = BLINK_LOG_DISPLAY_CAP * 2;
    for (let i = 0; i < past; i++) {
      events = appendEvent(events, eventAt(i));
    }
    expect(events.length).toBe(past);
    // The FIRST blink of the session is the one the old ring buffer
    // dropped, so that is the one worth naming.
    expect(events[0]?.atMs).toBe(0);
    expect(events[events.length - 1]?.atMs).toBe(past - 1);
  });

  it("holds exactly the record cap, then drops the oldest", () => {
    let events: BlinkEvent[] = [];
    for (let i = 0; i < BLINK_LOG_RECORD_CAP; i++) {
      events = appendEvent(events, eventAt(i));
    }
    expect(events.length).toBe(BLINK_LOG_RECORD_CAP);
    events = appendEvent(events, eventAt(999999));
    expect(events.length).toBe(BLINK_LOG_RECORD_CAP);
    expect(events[0]?.atMs).toBe(1);
    expect(events[events.length - 1]?.atMs).toBe(999999);
  });
});

describe("eventsForDisplay, the reading tail", () => {
  it("returns everything while the session is short", () => {
    const events = [eventAt(1), eventAt(2)];
    expect(eventsForDisplay(events)).toHaveLength(2);
  });

  it("returns the newest events once the session is long", () => {
    let events: BlinkEvent[] = [];
    for (let i = 0; i < BLINK_LOG_DISPLAY_CAP + 10; i++) {
      events = appendEvent(events, eventAt(i));
    }
    const shown = eventsForDisplay(events);
    expect(shown).toHaveLength(BLINK_LOG_DISPLAY_CAP);
    // Trimmed from the front, so the reader sees the most recent.
    expect(shown[0]?.atMs).toBe(10);
    expect(shown[shown.length - 1]?.atMs).toBe(BLINK_LOG_DISPLAY_CAP + 9);
  });

  it("does not disturb the record it was given", () => {
    let events: BlinkEvent[] = [];
    for (let i = 0; i < BLINK_LOG_DISPLAY_CAP + 5; i++) {
      events = appendEvent(events, eventAt(i));
    }
    eventsForDisplay(events);
    expect(events).toHaveLength(BLINK_LOG_DISPLAY_CAP + 5);
  });
});

describe("serialiseBlinkEvents, when rows went missing", () => {
  it("says so, in the file, when fewer rows survived than were detected", () => {
    const csv = serialiseBlinkEvents([eventAt(1), eventAt(2)], [], 60);
    expect(csv).toContain(
      "# WARNING: 58 earlier blinks were detected but are NOT in this file",
    );
    expect(csv).toContain("# blinks_detected: 60");
    expect(csv).toContain("# blinks_recorded: 2");
  });

  it("stays quiet when the record is complete", () => {
    const csv = serialiseBlinkEvents([eventAt(1), eventAt(2)], [], 2);
    expect(csv).not.toContain("WARNING");
  });

  // A count BELOW the row count would mean the caller is confused, and
  // inventing a negative loss would be worse than saying nothing.
  it("stays quiet rather than reporting a negative loss", () => {
    const csv = serialiseBlinkEvents([eventAt(1), eventAt(2)], [], 1);
    expect(csv).not.toContain("WARNING");
  });

  it("stays quiet when no count was supplied", () => {
    const csv = serialiseBlinkEvents([eventAt(1)]);
    expect(csv).not.toContain("WARNING");
  });

  it("puts the warning above the column header, not inside the rows", () => {
    const csv = serialiseBlinkEvents([eventAt(1)], ["# clip: a.mp4"], 9);
    const lines = (csv ?? "").split("\r\n");
    expect(lines[0]).toBe("# clip: a.mp4");
    expect(lines[1]).toContain("WARNING");
    expect(lines[4]).toBe(BLINK_CSV_COLUMNS.join(","));
  });
});

describe("blinkTableRow", () => {
  it("gives five cells in header order, units left to the header", () => {
    const { cells } = blinkTableRow(
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
    // Repeating "ms" and "mm" on every row was most of the ink in the
    // prose list this replaced and none of the information.
    expect(cells).toEqual(["42.3", "133", "5.2", "68", "77"]);
    expect(cells).toHaveLength(BLINK_TABLE_HEADERS.length);
  });

  it("keeps its shape when the analysis produced none", () => {
    // A dash rather than a blank: an empty cell reads as a rendering
    // fault, and this is a real blink whose shape could not be measured.
    const { cells, faint } = blinkTableRow(eventAt(11000), 10000);
    expect(cells[0]).toBe("1.0");
    expect(cells[1]).toBe("133");
    expect(cells.slice(2)).toEqual(["—", "—", "—"]);
    expect(faint).toBe(false);
  });

  it("marks a blink that barely moved, without hiding it", () => {
    // The export keeps these rows, so the panel must not disagree with
    // the file. Measured sessions put real blinks at 2.2 to 6.9 mm and
    // the phantoms under 1 mm.
    const faintRow = blinkTableRow(
      {
        atMs: 1000,
        durationMs: 117,
        startFrame: null,
        endFrame: null,
        shape: {
          amplitudeMm: 0.9,
          peakClosingVelocityMmPerS: 52,
          amplitudeOverVelocityMs: 18,
        },
      },
      0,
    );
    expect(faintRow.faint).toBe(true);
    expect(faintRow.cells[2]).toBe("0.9");
  });

  it("does not mark an ordinary blink as faint", () => {
    const ordinary = blinkTableRow(
      {
        atMs: 1000,
        durationMs: 117,
        startFrame: null,
        endFrame: null,
        shape: {
          amplitudeMm: 2.5,
          peakClosingVelocityMmPerS: 166,
          amplitudeOverVelocityMs: 15,
        },
      },
      0,
    );
    expect(ordinary.faint).toBe(false);
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
