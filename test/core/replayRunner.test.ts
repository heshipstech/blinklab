import { describe, expect, it } from "vitest";

import { missFacts } from "../../src/core/blinkReplay";
import {
  MISS_FACTS_COLUMNS,
  joinMissFacts,
  parseMissTable,
  parseTrace,
  serialiseMissFacts,
} from "../../src/core/replayTables";
import {
  readText,
  readTraceDir,
  runRequested,
  writeText,
} from "../../tools/replayRunner.mjs";

// Roadmap 10.8a5, the replay runner. `joinMissFacts` is the whole
// runner minus the disk: it takes the committed miss table and a map
// of each clip's trace, and returns the per-miss table. The disk half
// in tools/replayRunner.mjs fills the map from a directory and writes
// the result; it runs only under the REPLAY_RUN env var, the same
// arrangement `fixtures:write` keeps, so it is exercised by
// `npm run replay:run` and not counted in the ordinary suite.

declare const process: {
  env: Record<string, string | undefined>;
};

const HEADER =
  "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm,irisAspectRatio";

/** A trace whose aperture dips below the line over the given frames. */
function traceWithBlinkAt(dip: readonly number[], frames = 8): string {
  const rows = [HEADER];
  for (let f = 0; f < frames; f += 1) {
    const aperture = dip.includes(f) ? "2" : "5";
    rows.push(`${String(f)},${String(f / 30)},${aperture},3,`);
  }
  return rows.join("\r\n");
}

function missTable(rows: readonly string[]): string {
  return [
    "clip,blink_id,startFrame,endFrame,frameLength,fullyClosedFrames",
    ...rows,
  ].join("\n");
}

describe("joining a miss table to its clips' traces", () => {
  it("is exactly what the pieces do by hand, per clip", () => {
    // The runner is a composition, not a reimplementation: the join of
    // one clip must equal missFacts over that clip's trace and spans
    // with the clip re-attached. Pinning the identity means the runner
    // can never quietly diverge from the tool it wraps.
    const trace = traceWithBlinkAt([2, 3]);
    const table = missTable(["clipA,7,2,3,2,2"]);
    const out = joinMissFacts(table, new Map([["clipA", trace]]));
    const byHand = serialiseMissFacts(
      missFacts("clipA", parseTrace(trace), parseMissTable(table)).map(
        (fact) => ({ ...fact, clip: "clipA" }),
      ),
    );
    expect(out).toBe(byHand);
    expect(out).toContain("clipA,7,2,3,");
  });

  it("collects every miss of a clip, in the table's order", () => {
    // The common case the committed table is full of: one clip with
    // several misses. Covers the grouping's append path, and pins that
    // a clip's rows come out in the order the table lists them.
    const trace = traceWithBlinkAt([2, 3, 5, 6], 10);
    const table = missTable(["clipA,7,2,3,2,2", "clipA,8,5,6,2,2"]);
    const out = joinMissFacts(table, new Map([["clipA", trace]]));
    const blinkIds = out
      .trimEnd()
      .split("\r\n")
      .slice(1)
      .map((line) => line.split(",")[1]);
    expect(blinkIds).toEqual(["7", "8"]);
  });

  it("refuses a miss table naming a clip the traces do not hold", () => {
    // The refusal this row exists for: a shorter table cannot tell "we
    // did not measure this clip" from "this clip had no misses".
    const table = missTable(["clipA,7,2,3,2,2", "clipB,9,5,6,2,1"]);
    expect(() =>
      joinMissFacts(table, new Map([["clipA", traceWithBlinkAt([2, 3])]])),
    ).toThrow(/clipB/);
  });

  it("walks clips in the order the table first names them", () => {
    // clipB is named first in the table but inserted second in the
    // map; the output follows the TABLE, so the row order is the
    // evidence's and not this map's iteration order.
    const table = missTable(["clipB,1,2,3,2,1", "clipA,2,2,3,2,1"]);
    const out = joinMissFacts(
      table,
      new Map([
        ["clipA", traceWithBlinkAt([2, 3])],
        ["clipB", traceWithBlinkAt([2, 3])],
      ]),
    );
    const clips = out
      .trimEnd()
      .split("\r\n")
      .slice(1)
      .map((line) => line.split(",")[0]);
    expect(clips).toEqual(["clipB", "clipA"]);
  });

  it("writes a header and nothing else when the table has no misses", () => {
    const table =
      "clip,blink_id,startFrame,endFrame,frameLength,fullyClosedFrames";
    expect(joinMissFacts(table, new Map())).toBe(
      MISS_FACTS_COLUMNS.join(",") + "\r\n",
    );
  });
});

// The disk half, run only when asked. `npm run replay:run` sets
// REPLAY_RUN and the three paths; the ordinary suite never registers
// this, so it does not touch the pinned count.
if (runRequested()) {
  describe("the replay runner over a real directory", () => {
    it("reads the trace directory and miss table and writes the result", () => {
      const traceDir = process.env["REPLAY_TRACE_DIR"];
      const table = process.env["REPLAY_MISS_TABLE"];
      const out = process.env["REPLAY_OUT"];
      if (traceDir === undefined || table === undefined || out === undefined) {
        throw new Error(
          "replay:run needs REPLAY_TRACE_DIR, REPLAY_MISS_TABLE and REPLAY_OUT",
        );
      }
      const text = joinMissFacts(readText(table), readTraceDir(traceDir));
      writeText(out, text);
      expect(text.length).toBeGreaterThan(0);
    });
  });
}
