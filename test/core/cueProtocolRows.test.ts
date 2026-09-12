import { describe, expect, it } from "vitest";

import {
  CUE_RESPONSE_WINDOW_MS,
  CUE_SCHEDULE,
  CUE_SETTLE_MS,
  CUE_TOTAL_MS,
  cueAt,
  cueTimeScale,
  scaledCues,
} from "../../src/core/cueSchedule";
import { cueMetadataRows } from "../../src/core/sessionMetadata";

// Roadmap 11.0b. The schedule became an instrument in 11.0a; this is
// the half that lets a session CARRY it — the export rows a reader
// scores from without this repository's code, and the scaled variant
// the e2e Check demands, which can never pass as a real run because
// the file itself says the scale.

describe("the scaled schedule", () => {
  it("scales every time and nothing else", () => {
    const half = scaledCues(0.5);
    expect(half.cues.length).toBe(CUE_SCHEDULE.length);
    expect(half.totalMs).toBe(CUE_TOTAL_MS * 0.5);
    half.cues.forEach((cue, i) => {
      const original = CUE_SCHEDULE[i];
      expect(cue.kind).toBe(original?.kind);
      expect(cue.atMs).toBe((original?.atMs ?? 0) * 0.5);
      expect(cue.holdMs).toBe((original?.holdMs ?? 0) * 0.5);
    });
  });

  it("at scale 1 it IS the schedule", () => {
    expect(scaledCues(1)).toEqual({
      cues: [...CUE_SCHEDULE],
      totalMs: CUE_TOTAL_MS,
    });
  });
});

describe("the test hook in the query string", () => {
  it("reads a scale in (0, 1]", () => {
    expect(cueTimeScale("?cueTimeScale=0.02")).toBe(0.02);
    expect(cueTimeScale("?cueTimeScale=1")).toBe(1);
  });

  it("answers 1 to everything else, because 1 is the protocol", () => {
    // A scale above 1 is a longer protocol nobody pre-registered, 0
    // is not a schedule, and garbage is garbage: all of them run the
    // real thing rather than a guessed variant.
    expect(cueTimeScale("")).toBe(1);
    expect(cueTimeScale("?other=3")).toBe(1);
    expect(cueTimeScale("?cueTimeScale=0")).toBe(1);
    expect(cueTimeScale("?cueTimeScale=-2")).toBe(1);
    expect(cueTimeScale("?cueTimeScale=1.5")).toBe(1);
    expect(cueTimeScale("?cueTimeScale=soon")).toBe(1);
  });
});

describe("cueAt still reads the unscaled schedule", () => {
  it("keeps its settle and done boundaries", () => {
    // The refactor that let a scaled schedule be walked must not have
    // moved the real one's boundaries.
    expect(cueAt(CUE_SETTLE_MS - 1)).toBe("settle");
    expect(cueAt(CUE_TOTAL_MS)).toBe("done");
    const first = cueAt(CUE_SETTLE_MS);
    expect(first).not.toBe("settle");
    expect(first).not.toBe("done");
  });
});

describe("the cue rows in the export", () => {
  const scale = 0.5;
  const rows = cueMetadataRows(12_345, scaledCues(scale).cues, scale);

  it("writes nothing when no protocol ran", () => {
    // Absence, never a block of unknowns: the pseudonym rule. A
    // session without the protocol has no schedule to describe.
    expect(cueMetadataRows(null, [...CUE_SCHEDULE], 1)).toEqual([]);
  });

  it("carries the start on the record clock and the scale out loud", () => {
    expect(rows).toContain("# cue_protocol_start_ms: 12345");
    // A shortened run can never pass as a real one: the file itself
    // says the scale, 1.000 on every honest session.
    expect(rows).toContain("# cue_time_scale: 0.500");
    expect(cueMetadataRows(0, [...CUE_SCHEDULE], 1)).toContain(
      "# cue_time_scale: 1.000",
    );
  });

  it("scales the response window with the schedule it scores", () => {
    expect(rows).toContain(
      `# cue_response_window_ms: ${Math.round(CUE_RESPONSE_WINDOW_MS * scale)}`,
    );
  });

  it("writes one row triple per instruction and none for rests", () => {
    const instructions = CUE_SCHEDULE.filter((cue) => cue.kind !== "rest");
    expect(rows).toContain(`# cues: ${instructions.length}`);
    expect(rows.filter((row) => /^# cue_\d+_kind:/.test(row)).length).toBe(
      instructions.length,
    );
    expect(rows.some((row) => row.includes(": rest"))).toBe(false);
  });

  it("numbers the cues in schedule order with their own times", () => {
    const firstInstruction = scaledCues(scale).cues.filter(
      (cue) => cue.kind !== "rest",
    )[0];
    expect(rows).toContain(`# cue_1_kind: ${firstInstruction?.kind}`);
    expect(rows).toContain(
      `# cue_1_seconds: ${((firstInstruction?.atMs ?? 0) / 1000).toFixed(3)}`,
    );
    expect(rows).toContain(
      `# cue_1_hold_ms: ${Math.round(firstInstruction?.holdMs ?? 0)}`,
    );
  });

  it("a start of zero is a start, not an absence", () => {
    // Measured absence versus a measured zero, the house rule: a
    // protocol that began the instant the record clock did began.
    expect(cueMetadataRows(0, [...CUE_SCHEDULE], 1).length).toBeGreaterThan(0);
  });
});
