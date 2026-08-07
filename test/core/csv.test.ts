import { describe, expect, it } from "vitest";

import type { FeatureRecord } from "../../src/core/featureRecord";
import {
  CSV_COLUMNS,
  csvCell,
  csvHeader,
  serializeRecords,
} from "../../src/core/csv";

const FULL: FeatureRecord = {
  timestampMs: 61000,
  faceDetected: true,
  fps: 60,
  apertureMm: 5.9,
  baselineMm: 7.2,
  shutBaselineMm: 7.2,
  blinkRatePerMin: 14,
  lastBlinkDurationMs: 133,
  lastBlinkAmplitudeMm: 3.4,
  lastBlinkPeakVelocityMmPerS: 72,
  perclos: 0.021,
  longClosureCount: 1,
  fixationCount: 12,
  fixationMedianMs: 383,
  fixating: true,
  onScreen: true,
};

const EMPTY_ROW: FeatureRecord = {
  timestampMs: 1000,
  faceDetected: false,
  fps: null,
  apertureMm: null,
  baselineMm: null,
  shutBaselineMm: null,
  blinkRatePerMin: null,
  lastBlinkDurationMs: null,
  lastBlinkAmplitudeMm: null,
  lastBlinkPeakVelocityMmPerS: null,
  perclos: null,
  longClosureCount: 0,
  fixationCount: null,
  fixationMedianMs: null,
  fixating: null,
  onScreen: null,
};

describe("csvCell, the edge cases a naive join gets wrong", () => {
  it("writes null as an empty field, never the word null", () => {
    // A reader parsing "null" as a number gets NaN; an empty field
    // is the CSV way of saying nothing was measured.
    expect(csvCell(null)).toBe("");
  });

  it("writes booleans as true and false", () => {
    expect(csvCell(true)).toBe("true");
    expect(csvCell(false)).toBe("false");
  });

  it("keeps numbers at full precision, no rounding on the way out", () => {
    expect(csvCell(0.021)).toBe("0.021");
    expect(csvCell(1 / 3)).toBe("0.3333333333333333");
    expect(csvCell(-0)).toBe("0");
    expect(csvCell(61000)).toBe("61000");
  });

  it("quotes a value containing a comma", () => {
    expect(csvCell("left, then right")).toBe('"left, then right"');
  });

  it("quotes a value containing a quote and doubles the quote", () => {
    // RFC 4180: the escape for a quote inside a quoted field is two
    // quotes. Getting this wrong corrupts every following column.
    expect(csvCell('he said "hello"')).toBe('"he said ""hello"""');
  });

  it("quotes a value containing a newline or carriage return", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("writes NaN and the infinities as empty, never as words", () => {
    // The schema refuses these upstream, so reaching the serialiser
    // means something broke. Writing "NaN" would be worse than
    // useless: pandas reads it as a missing value, so a broken
    // computation would be indistinguishable from an honest null.
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(Infinity)).toBe("");
    expect(csvCell(-Infinity)).toBe("");
  });

  it("leaves an ordinary string unquoted", () => {
    expect(csvCell("eyes closed share")).toBe("eyes closed share");
  });
});

describe("csvHeader", () => {
  it("names every FeatureRecord field, in the exported column order", () => {
    // The load bearing test: if a field joins the record without a
    // column, the export silently drops it and Phase 7 never sees
    // it. Comparing against the keys of a real record catches that.
    expect([...CSV_COLUMNS].sort()).toEqual(Object.keys(FULL).sort());
  });

  it("writes the columns as one comma separated line", () => {
    expect(csvHeader()).toBe(CSV_COLUMNS.join(","));
    expect(csvHeader().startsWith("timestampMs,")).toBe(true);
  });
});

describe("serializeRecords", () => {
  it("refuses an empty session rather than writing a lonely header", () => {
    expect(serializeRecords([])).toBeNull();
  });

  it("writes the header then one line per record, CRLF throughout", () => {
    const csv = serializeRecords([FULL, EMPTY_ROW]);
    expect(csv).not.toBeNull();
    const lines = csv?.split("\r\n") ?? [];
    // Header, two rows, and an empty tail from the trailing CRLF
    // that closes the final record.
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(csvHeader());
    expect(lines[3]).toBe("");
  });

  it("writes a full row in column order with real values", () => {
    const csv = serializeRecords([FULL]);
    const row = csv?.split("\r\n")[1] ?? "";
    expect(row).toBe(
      "61000,true,60,5.9,7.2,7.2,14,133,3.4,72,0.021,1,12,383,true,true",
    );
  });

  it("writes an all-null row as empty fields, keeping the commas", () => {
    // Sixteen columns means fifteen commas even when almost nothing
    // was measured: a short row would shift every later column.
    const csv = serializeRecords([EMPTY_ROW]);
    const row = csv?.split("\r\n")[1] ?? "";
    expect(row).toBe("1000,false,,,,,,,,,,0,,,,");
    expect(row.split(",")).toHaveLength(CSV_COLUMNS.length);
  });

  it("round trips a staged session back to the same values", () => {
    // A naive parser, good enough because the schema forbids the
    // characters that would need a real one in these columns.
    const csv = serializeRecords([FULL, EMPTY_ROW]) ?? "";
    const [header, ...rows] = csv.trimEnd().split("\r\n");
    const columns = header?.split(",") ?? [];
    const parsed = rows.map((row) => {
      const cells = row.split(",");
      return Object.fromEntries(
        columns.map((name, i) => {
          const cell = cells[i] ?? "";
          if (cell === "") return [name, null];
          if (cell === "true") return [name, true];
          if (cell === "false") return [name, false];
          return [name, Number(cell)];
        }),
      );
    });
    expect(parsed[0]).toEqual(FULL);
    expect(parsed[1]).toEqual(EMPTY_ROW);
  });

  it("writes metadata comment lines above the header", () => {
    const csv = serializeRecords(
      [FULL],
      [
        "# kss_before: 3 (Alert)",
        "# kss_after: 7 (Sleepy, but no effort to keep awake)",
      ],
    );
    const lines = csv?.split("\r\n") ?? [];
    expect(lines[0]).toBe("# kss_before: 3 (Alert)");
    expect(lines[1]).toBe(
      "# kss_after: 7 (Sleepy, but no effort to keep awake)",
    );
    expect(lines[2]).toBe(csvHeader());
    expect(lines[3]?.startsWith("61000,")).toBe(true);
  });

  it("writes no metadata block when none is given", () => {
    const csv = serializeRecords([FULL]);
    expect(csv?.startsWith(csvHeader())).toBe(true);
  });

  it("still refuses an empty session even with metadata to write", () => {
    // Metadata without records describes a recording that did not
    // happen, which is the header-only file wearing a hat.
    expect(serializeRecords([], ["# kss_before: 3 (Alert)"])).toBeNull();
  });

  it("survives a record carrying a hostile string in a future column", () => {
    // The record type has no string fields today, but the serialiser
    // must not become the weak point when one arrives.
    const hostile = { ...FULL, note: 'a,b"c\nd' } as unknown as FeatureRecord;
    const csv = serializeRecords([hostile]);
    expect(csv).not.toBeNull();
    // The extra field has no column, so it must not appear at all.
    expect(csv?.includes("a,b")).toBe(false);
  });
});
