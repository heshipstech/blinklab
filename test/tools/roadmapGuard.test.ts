import { describe, expect, it } from "vitest";

import {
  blendshapesEnabled,
  blockedRows,
  roadmapRow,
} from "../../tools/roadmapGuard.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap amendment 18. A ladder that offers work it cannot deliver
// costs whoever picks the row exactly the time it takes to discover
// that, and then costs the next reader the same again, because nothing
// wrote it down.
//
// Five rows were tried this way in one session. So a row that cannot
// be STARTED now says so, in a marker a test can read, and the marker
// has to name what would unblock it: "BLOCKED" alone is the same
// silence in a louder font.
//
// One of those blockers is checkable against the code rather than
// remembered, and it is pinned here: row 12.4 wants `jawOpen`, which
// is a blendshape, and this app does not ask the landmarker for
// blendshapes. When row 12.2 turns them on, this test reddens and the
// marker has to come off — which is the point. A blocker that outlives
// its blocker is the next stale sentence.

const root = repoRoot();
const roadmap = readRepoFile("ROADMAP.md", root);

describe("reading a blocked row", () => {
  it("finds the marker and what it says", () => {
    const rows = blockedRows("- [ ] 9.9 A thing **BLOCKED: on row 1.1.**\n");
    expect(rows).toEqual([{ id: "9.9", reason: "on row 1.1." }]);
  });

  it("ignores a ticked row, which cannot be blocked", () => {
    expect(blockedRows("- [x] 9.9 Done **BLOCKED: on row 1.1.**\n")).toEqual(
      [],
    );
  });

  it("refuses a marker that names nothing", () => {
    // "BLOCKED" with no reason is the same silence in a louder font:
    // the next reader still has to work out what would unblock it.
    expect(() => blockedRows("- [ ] 9.9 A thing **BLOCKED:**\n")).toThrow(
      /names nothing/,
    );
  });
});

describe("finding one row", () => {
  it("returns the row's text", () => {
    expect(roadmapRow("- [ ] 1.1 first\n- [ ] 2.2 second\n", "2.2")).toContain(
      "second",
    );
  });

  it("refuses a row that is not there rather than returning nothing", () => {
    expect(() => roadmapRow("- [ ] 1.1 first\n", "9.9")).toThrow(/9\.9/);
  });
});

describe("the blendshape blocker, checked against the code", () => {
  it("this app does not ask the landmarker for blendshapes", () => {
    expect(blendshapesEnabled(root)).toBe(false);
  });

  it("so row 12.4, which wants jawOpen, is marked blocked on 12.2", () => {
    // When 12.2 lands, the assertion above reddens first and this
    // marker comes off with it. A blocker that outlives its blocker is
    // the next stale sentence in a repository that keeps finding them.
    const row = roadmapRow(roadmap, "12.4");
    expect(row).toContain("jawOpen");
    expect(row).toMatch(/\*\*BLOCKED:[^*]*12\.2/);
  });
});

describe("every blocked row in this repository names its blocker", () => {
  it("parses them all without refusing one", () => {
    const rows = blockedRows(roadmap);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        row.reason.length,
        `${row.id} says almost nothing`,
      ).toBeGreaterThan(20);
    }
  });
});
