import { describe, expect, it } from "vitest";

import {
  MISS_FACTS_COLUMNS,
  parseMissTable,
  parseTrace,
  serialiseMissFacts,
} from "../../src/core/replayTables";

// Roadmap 10.8a3a. The reading and writing half of the replay runner,
// as pure string work, so the disk half next door stays four lines and
// this stays testable without one.
//
// Both formats are REAL and committed, not invented here. The trace is
// what `serialiseFrameTrace` writes and `tools/measure_corpus.mjs`
// saves as `<clip>.frames.csv`; the miss table is the six-column shape
// of `docs/evidence/2026-08-21-rearm/eyeblink8_misses.csv`, which
// `miss_autopsy.py` and `miss_overlap.py` already read. Parsing them
// loosely would be inventing a third dialect of a format two tools
// agree on.

describe("reading a corpus run's per-frame trace", () => {
  it("reads the columns the exporter writes", () => {
    const csv = [
      "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio",
      "0,0,5.2,3.1,0.88",
    ].join("\r\n");
    expect(parseTrace(csv)).toEqual([
      {
        frameIndex: 0,
        mediaTimeSeconds: 0,
        apertureMm: 5.2,
        blinkLineMm: 3.1,
      },
    ]);
  });

  it("skips the metadata rows a real export begins with", () => {
    // A trace file opens with `# source: file`, `# clip: ...`,
    // `# measurement_mode: stepped` and six more before the header. A
    // reader that took line one as the header would find no columns at
    // all, and one that took the first comma-separated line would read
    // a metadata value as data.
    const csv = [
      "# source: file",
      "# clip: 26122013_223310_cam.mp4",
      "# measurement_mode: stepped",
      "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio",
      "7,0.2333,2.4,3.1,0.51",
    ].join("\r\n");
    expect(parseTrace(csv)).toHaveLength(1);
    expect(parseTrace(csv)[0]?.frameIndex).toBe(7);
  });

  it("reads an empty cell as null, which is what the exporter means", () => {
    // No trusted face was measured on that frame. Reading it as zero
    // would say the eye was shut.
    const csv = [
      "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio",
      "3,0.1,,,",
    ].join("\r\n");
    const [row] = parseTrace(csv);
    expect(row?.apertureMm).toBeNull();
    expect(row?.blinkLineMm).toBeNull();
  });

  it("survives the LF line endings a hand-edited file may carry", () => {
    const csv =
      "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio\n0,0,5,3,0.9\n";
    expect(parseTrace(csv)).toHaveLength(1);
  });

  it("refuses a file whose header is not the trace's", () => {
    // The runner takes a directory of files named by convention. A
    // wrong file that parsed to an empty trace would report every miss
    // as never-crossed, which is a confident wrong answer.
    expect(() =>
      parseTrace("clip,blink_id,startFrame\n26122013,12,3644"),
    ).toThrow(/frameIndex/);
  });

  it("refuses a file with no rows below the header", () => {
    expect(() =>
      parseTrace(
        "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio",
      ),
    ).toThrow(/no rows/i);
  });
});

describe("reading the committed miss table", () => {
  it("reads the six-column shape both Python tools already read", () => {
    const csv = [
      "clip,blink_id,startFrame,endFrame,frameLength,fullyClosedFrames",
      "26122013_223310_cam,12,3644,3650,7,4",
    ].join("\n");
    expect(parseMissTable(csv)).toEqual([
      {
        clip: "26122013_223310_cam",
        blinkId: "12",
        startFrame: 3644,
        endFrame: 3650,
      },
    ]);
  });

  it("keeps the blink id as text, because it is an identifier", () => {
    // It joins two tables. Reading it as a number would make "007" and
    // "7" the same row in one tool and different in another.
    const csv = [
      "clip,blink_id,startFrame,endFrame,frameLength,fullyClosedFrames",
      "a,007,1,2,2,1",
    ].join("\n");
    expect(parseMissTable(csv)[0]?.blinkId).toBe("007");
  });

  it("refuses a table missing a column it joins on", () => {
    expect(() => parseMissTable("clip,blink_id\na,1")).toThrow(/startFrame/);
  });

  it("groups nothing and preserves order, so the runner decides", () => {
    const csv = [
      "clip,blink_id,startFrame,endFrame,frameLength,fullyClosedFrames",
      "b,1,1,2,2,1",
      "a,2,3,4,2,1",
    ].join("\n");
    expect(parseMissTable(csv).map((m) => m.clip)).toEqual(["b", "a"]);
  });
});

describe("writing the per-miss table", () => {
  it("writes the header and one row per fact", () => {
    const csv = serialiseMissFacts([
      {
        clip: "a",
        blinkId: "1",
        startFrame: 10,
        endFrame: 12,
        crossingFrame: 10,
        reopenFrame: 15,
        crossingToReopenMs: 166.67,
        msSincePreviousBlink: 100,
        rearmedAtCrossing: false,
      },
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(MISS_FACTS_COLUMNS.join(","));
    expect(lines[1]).toBe("a,1,10,12,10,15,166.67,100,false");
  });

  it("writes a null as an empty cell, the exporter's own convention", () => {
    // Not "null", not "NA", not 0. The trace format this joins to uses
    // an empty cell for "no measurement", and two conventions in one
    // pipeline is how a reader learns to guess.
    const csv = serialiseMissFacts([
      {
        clip: "a",
        blinkId: "1",
        startFrame: 10,
        endFrame: 12,
        crossingFrame: null,
        reopenFrame: null,
        crossingToReopenMs: null,
        msSincePreviousBlink: null,
        rearmedAtCrossing: null,
      },
    ]);
    expect(csv.trimEnd().split("\r\n")[1]).toBe("a,1,10,12,,,,,");
  });

  it("writes a header even with no facts, so an empty table is readable", () => {
    expect(serialiseMissFacts([]).trimEnd()).toBe(MISS_FACTS_COLUMNS.join(","));
  });

  it("names no mechanism in its columns either", () => {
    // The same refusal 10.8a2 makes, held at the format boundary too:
    // a column cannot be smuggled in by the writer.
    expect(MISS_FACTS_COLUMNS).toEqual([
      "clip",
      "blink_id",
      "startFrame",
      "endFrame",
      "crossingFrame",
      "reopenFrame",
      "crossingToReopenMs",
      "msSincePreviousBlink",
      "rearmedAtCrossing",
    ]);
  });
});
