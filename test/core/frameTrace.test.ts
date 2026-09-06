import { describe, expect, it } from "vitest";

import {
  FRAME_TRACE_RECORD_CAP,
  appendFrameTraceRow,
  serialiseFrameTrace,
  type FrameTraceRow,
} from "../../src/core/frameTrace";

// The per-frame trace, docs/miss-trace.txt: the tool the miss
// investigation needs first. One row per measured clip frame, joined
// to the corpus ground truth by frame number, carrying the aperture
// the instrument read and the line the detector actually compared
// against.

function row(
  frameIndex: number,
  apertureMm: number | null = 6.5,
  blinkLineMm: number | null = 4.1,
  irisAspectRatio: number | null = 0.95,
): FrameTraceRow {
  return {
    frameIndex,
    mediaTimeSeconds: frameIndex / 30,
    apertureMm,
    blinkLineMm,
    irisAspectRatio,
  };
}

describe("the per-frame trace", () => {
  it("serialises one row per frame, nulls as empty cells", () => {
    const csv = serialiseFrameTrace(
      [row(0), row(1, null, null, null)],
      ["# source: clip session-01.mp4"],
      2,
    );
    expect(csv).toBe(
      "# source: clip session-01.mp4\r\n" +
        "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio\r\n" +
        "0,0,6.5,4.1,0.95\r\n" +
        "1,0.03333333333333333,,,\r\n",
    );
  });

  it("an empty trace is null, never a lone header", () => {
    // The blink log's refusal, for the same reason: a header with no
    // rows claims a measurement in which frames were traced and none
    // arrived, which is a different fact from no trace at all.
    expect(serialiseFrameTrace([], [], 0)).toBeNull();
  });

  it("declares truncation on its own face, the blink log's precedent", () => {
    const csv = serialiseFrameTrace([row(0)], [], 5);
    expect(csv).toContain(
      "# WARNING: 4 later frames were measured but are NOT in this file",
    );
    expect(csv).toContain("# frames_recorded: 1");
  });

  // Roadmap 10.16, ladder A27. The warning used to declare its own
  // `frames_measured` row while the caller's coverage rows already
  // carried that key, and a repeated key is what loader.py refuses as
  // an edited or damaged file. So the one file the warning exists for
  // was the one file the Python side would not read.
  it("never writes a key its caller already owns", () => {
    const coverage = ["# frames_measured: 5"];
    const csv = serialiseFrameTrace([row(0)], coverage, 5) ?? "";
    // The file uses CRLF, as every export here does.
    const declared = csv
      .split(/\r?\n/)
      .filter((line) => line.startsWith("# frames_measured:"));
    expect(declared).toEqual(["# frames_measured: 5"]);
  });

  it("says nothing about loss when nothing was lost", () => {
    expect(serialiseFrameTrace([row(0)], [], 1)).not.toContain("WARNING");
  });

  it("keeps the PREFIX when the cap binds, unlike the blink log", () => {
    // The blink log drops its oldest entry, which is right for a live
    // session where the recent past matters most. The trace exists to
    // be joined to ground truth BY FRAME NUMBER, and a file whose
    // first recorded frame silently moves breaks every join anchored
    // at the front. So the trace stops appending instead: the prefix
    // stays intact and the truncation note names what fell off the
    // end.
    let rows: FrameTraceRow[] = [];
    for (let index = 0; index < FRAME_TRACE_RECORD_CAP + 5; index += 1) {
      rows = appendFrameTraceRow(rows, row(index));
    }
    expect(rows.length).toBe(FRAME_TRACE_RECORD_CAP);
    expect(rows[0]?.frameIndex).toBe(0);
    expect(rows[rows.length - 1]?.frameIndex).toBe(FRAME_TRACE_RECORD_CAP - 1);
  });

  it("pins the cap to the blink log's convention, above the corpus", () => {
    // 20,000 follows BLINK_LOG_RECORD_CAP rather than inventing a
    // second convention, and sits above the longest Eyeblink8 clip's
    // 15,784 frames, so it never binds on the corpus this exists for.
    expect(FRAME_TRACE_RECORD_CAP).toBe(20000);
  });
});
