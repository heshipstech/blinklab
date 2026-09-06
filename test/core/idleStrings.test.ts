import { describe, expect, it } from "vitest";

import { IDLE_READOUTS, idleReadoutText } from "../../src/core/idleStrings";

// Roadmap 14.0b (audit B19). The idle page used to say "Alertness
// score: measuring..." and "Blinks: 0" before any camera had started,
// which asserts a measurement in progress and a count of something
// never counted. The idle strings are a table of their own so the
// page, docs/UI.md and the guard read one list.

describe("what a readout says before anything has run", () => {
  it("never claims to be measuring, and never counts what it never counted", () => {
    for (const [label, value] of IDLE_READOUTS) {
      expect(label.length).toBeGreaterThan(0);
      expect(value).not.toMatch(/measuring\.\.\./);
      expect(value).not.toMatch(/^\d/);
    }
  });

  it("says out loud that nothing is being measured where a number would sit", () => {
    const table = new Map(IDLE_READOUTS);
    expect(table.get("Alertness score")).toBe("not measuring");
    expect(table.get("Blinks")).toBe("not measuring");
    expect(table.get("PERCLOS (eyes closed share, last 60 s)")).toBe(
      "not measuring",
    );
    expect(table.get("Aperture stability")).toBe("not measuring");
  });

  it("joins label and value the way the page splits them", () => {
    // writeReadout() splits on the first ": " into a label and a value
    // column; the joined form has to round-trip through that split.
    expect(idleReadoutText("Blinks", "not measuring")).toBe(
      "Blinks: not measuring",
    );
    expect(
      idleReadoutText(
        "PERCLOS (eyes closed share, last 60 s)",
        "not measuring",
      ),
    ).toBe("PERCLOS (eyes closed share, last 60 s): not measuring");
  });

  it("names each readout once", () => {
    const labels = IDLE_READOUTS.map(([label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
