import { describe, expect, it } from "vitest";

import {
  blendshapesEnabled,
  blockedRows,
  roadmapRow,
  staleStartables,
  startableClaims,
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

// Roadmap amendment 19. Amendment 18 ended by naming the rows that
// were still startable, and that sentence was wrong twice inside a
// day: once when it named a row whose Check waits on a corpus rule,
// which the amendment corrected inside itself, and again when three of
// the four it left standing turned out to have a clause this container
// cannot meet. The ladder's statement about where work can begin is
// exactly the kind of sentence this project has learned not to leave
// unattended.
describe("the ladder's own claim about where work can start", () => {
  it("reads the rows a startable sentence names", () => {
    expect(
      startableClaims(
        "Rows 1.1, 2.2 and 3.3 remain startable and are not marked.",
      ),
    ).toEqual(["1.1", "2.2", "3.3"]);
  });

  it("reads a claim about a single row", () => {
    expect(
      startableClaims("Row 4.4b remains startable and is not marked."),
    ).toEqual(["4.4b"]);
  });

  it("refuses a ladder that makes no such claim", () => {
    // Not an empty list. A ladder with nothing to say about where work
    // can start is the state amendment 18 was written to end, and a
    // guard reporting "nothing claimed" would make this satisfiable
    // with a delete.
    expect(() => startableClaims("A ladder with no such sentence")).toThrow(
      /startable/,
    );
  });

  it("catches a claimed row that is blocked", () => {
    const text = [
      "- [ ] 9.9 A row **BLOCKED: on something named.**",
      "Rows 9.9 remain startable and are not marked.",
    ].join("\n");
    expect(staleStartables(text)).toEqual([
      { id: "9.9", why: "carries a BLOCKED marker" },
    ]);
  });

  it("catches a claimed row that is already done", () => {
    // A different staleness with the same cost. "Startable" said of
    // finished work sends the next reader to a row with nothing left
    // in it.
    const text = [
      "- [x] 9.9 A row, DONE.",
      "Rows 9.9 remain startable and are not marked.",
    ].join("\n");
    expect(staleStartables(text)).toEqual([
      { id: "9.9", why: "is already ticked" },
    ]);
  });

  it("says nothing about a claimed row that is open and unmarked", () => {
    const text = [
      "- [ ] 9.9 A row with work left in it.",
      "Rows 9.9 remain startable and are not marked.",
    ].join("\n");
    expect(staleStartables(text)).toEqual([]);
  });

  it("refuses a claim naming a row that does not exist", () => {
    expect(() =>
      staleStartables("Rows 9.9 remain startable and are not marked."),
    ).toThrow(/no row 9\.9/);
  });

  it("holds the ladder to its own sentence", () => {
    const stale = staleStartables(roadmap);
    expect(
      stale,
      `the startable sentence is out of date: ${stale
        .map((row) => `${row.id} ${row.why}`)
        .join("; ")}`,
    ).toEqual([]);
  });
});
