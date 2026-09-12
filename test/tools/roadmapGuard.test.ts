import { describe, expect, it } from "vitest";

import {
  blendshapesEnabled,
  blockedRows,
  expandRowRange,
  gateCaveats,
  gatedStartables,
  phaseGates,
  roadmapRow,
  retiredWithBlocker,
  ripeCaveats,
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

// Roadmap 10.0b8, from amendment 20. Amendment 19's guard holds a
// claimed-startable row to its own LINE: open, unmarked. A row can
// pass that while the header of its PHASE forbids it from beginning at
// all, and three rows did exactly that on the day the guard shipped.
//
// The Check is what a row must prove. The gate is whether it may
// begin. Reading one has never told anybody the other.

describe("reading a row range out of the ladder's prose", () => {
  it("expands a lettered range", () => {
    expect(expandRowRange("10.12a-c")).toEqual(["10.12a", "10.12b", "10.12c"]);
    expect(expandRowRange("10.13a-b")).toEqual(["10.13a", "10.13b"]);
  });

  it("passes a plain row through unchanged", () => {
    expect(expandRowRange("13.8b")).toEqual(["13.8b"]);
    expect(expandRowRange("10.11")).toEqual(["10.11"]);
  });

  it("refuses something it cannot read rather than returning nothing", () => {
    // A gate parsed to an empty list is a gate that permits
    // everything, which is worse than no gate at all because it looks
    // like one. Roadmap 10.0b3 learned this about a different guard.
    expect(() => expandRowRange("12.17's tool")).toThrow(/cannot read/);
    expect(() => expandRowRange("10.12c-a")).toThrow(/cannot read/);
  });
});

describe("the gate at the head of a phase", () => {
  const gates = phaseGates(roadmap);

  it("finds the one Phase 12 carries", () => {
    const twelve = gates.find((gate) => gate.phase.startsWith("12."));
    expect(twelve).toBeDefined();
    expect(twelve?.prerequisites).toEqual([
      "10.11",
      "10.12a",
      "10.12b",
      "10.12c",
      "10.13a",
      "10.13b",
      "10.14",
      "13.2",
      "13.8b",
    ]);
  });

  it("reads the exemptions the header names", () => {
    const twelve = gates.find((gate) => gate.phase.startsWith("12."));
    expect(twelve?.exemptRows).toEqual([
      "12.0a",
      "12.0b",
      "12.1",
      "12.2",
      "12.3",
      "12.15",
      "12.16",
    ]);
  });

  it("keeps the exemption that is not a whole row, rather than dropping it", () => {
    // "12.17's tool" exempts a TOOL and not the row, so it must not
    // become an exemption for 12.17. Reported rather than silently
    // discarded, because a guard that quietly drops what it cannot
    // parse is a guard nobody can audit.
    const twelve = gates.find((gate) => gate.phase.startsWith("12."));
    expect(twelve?.exemptOther).toEqual(["12.17's tool"]);
    expect(twelve?.exemptRows).not.toContain("12.17");
  });

  it("finds no gate on a phase that carries none", () => {
    expect(gates.find((gate) => gate.phase.startsWith("0."))).toBeUndefined();
  });
});

describe("a claimed row its phase will not let start", () => {
  const LADDER = [
    "## Phase 9. A phase with a gate",
    "",
    "GATE, from amendment 1: no signal row here starts before 8.1 and 8.2 are",
    "ticked. The instrument rows are exempt and are the gate's other half: 9.5.",
    "",
    "- [x] 8.1 Done.",
    "- [ ] 8.2 Not done.",
    "- [ ] 9.4 A gated row.",
    "- [ ] 9.5 An exempt row.",
    "",
  ].join("\n");

  it("is reported, with the prerequisite that is missing", () => {
    const text = `${LADDER}Rows 9.4 remain startable and are not marked.`;
    expect(gatedStartables(text)).toEqual([
      { id: "9.4", why: "its phase gate waits on 8.2" },
    ]);
  });

  it("says nothing about a row the header exempts by name", () => {
    const text = `${LADDER}Rows 9.5 remain startable and are not marked.`;
    expect(gatedStartables(text)).toEqual([]);
  });

  it("carries an exemption down to a lettered sub-row", () => {
    // This ladder splits a row that outgrows one pull request into
    // lettered halves — 9.3 into 9.3a and 9.3b, 10.0b into nine — and
    // an era rule tells it to. Splitting for SIZE cannot change
    // whether the work is exempt: 12.16a and 12.16b are 12.16. So the
    // exemption follows the parent rather than the spelling, and the
    // gate is not quietly widened by a rename.
    const split = [
      "## Phase 9. A phase with a gate",
      "",
      "GATE, from amendment 1: no signal row here starts before 8.1 and 8.2 are",
      "ticked. The instrument rows are exempt and are the gate's other half: 9.5.",
      "",
      "- [x] 8.1 Done.",
      "- [ ] 8.2 Not done.",
      "- [ ] 9.5b An exempt row, split in half.",
      "",
      "Rows 9.5b remain startable and are not marked.",
    ].join("\n");
    expect(gatedStartables(split)).toEqual([]);
  });

  it("does not carry an exemption sideways to a different row", () => {
    // 9.4 is not a sub-row of 9.5, and a reader of the gate would not
    // think it was. Only the parent chain counts.
    const text = `${LADDER}Rows 9.4 remain startable and are not marked.`;
    expect(gatedStartables(text).map((row) => row.id)).toEqual(["9.4"]);
  });

  it("says nothing once every prerequisite is ticked", () => {
    const text = `${LADDER.replace("- [ ] 8.2", "- [x] 8.2")}Rows 9.4 remain startable and are not marked.`;
    expect(gatedStartables(text)).toEqual([]);
  });

  it("says nothing about a row in a phase with no gate", () => {
    const text = [
      "## Phase 7. No gate here",
      "",
      "- [ ] 7.1 A row.",
      "",
      "Rows 7.1 remain startable and are not marked.",
    ].join("\n");
    expect(gatedStartables(text)).toEqual([]);
  });

  it("holds the ladder to its own gates", () => {
    const gated = gatedStartables(roadmap);
    expect(
      gated,
      `the startable sentence names rows their phase will not let start: ${gated
        .map((row) => `${row.id} ${row.why}`)
        .join("; ")}`,
    ).toEqual([]);
  });

  it("would have caught the three rows amendment 20 records", () => {
    // The whole point, stated against the real ladder. Claiming 12.7,
    // whose every Check clause is satisfiable here, is refused by the
    // gate — which is what amendment 19's guard could not see and
    // what cost three rows on the day it shipped.
    // The ladder's live claim (amendment 24's eight rows) is swapped
    // for a list claiming 12.7 alone, so the gate check is exercised
    // against a row whose phase forbids it whatever the real list
    // currently says.
    const claimed = roadmap.replace(
      "Rows 10.3, 14.3 and 14.9a remain startable and are not marked",
      "Rows 12.7 remain startable and are not marked",
    );
    expect(staleStartables(claimed)).toEqual([]);
    expect(gatedStartables(claimed).map((row) => row.id)).toEqual(["12.7"]);
  });
});

// Roadmap 10.0b9. Amendment 20 gave three rows a caveat: each was
// started while the Phase 12 gate was shut, each is unwired so nothing
// published depends on it, and each has constants chosen against an
// instrument that 13.8b and 12.0a are going to change. The caveat says
// re-look when those land.
//
// That sentence is prose, and prose kept true by somebody remembering
// is the one thing this repository has watched fail over and over. So
// the caveat names the rows it waits on, and the build goes red the
// moment they are ticked. Same self-retiring shape as drozyGuard and
// the detector ratchet: the reminder arrives when the instrument
// moves, not when a person happens to re-read a header.

describe("the caveats amendment 20 left on three rows", () => {
  it("finds all three, each naming what it waits on", () => {
    const caveats = gateCaveats(roadmap);
    expect(caveats.map((one) => one.id).sort()).toEqual([
      "12.14",
      "12.6",
      "12.9",
    ]);
    for (const caveat of caveats) {
      // 13.8b landed on 10 September 2026 and its re-look is written
      // into each caveat, so the one row still waited on is 12.0a.
      expect(caveat.waitsOn).toEqual(["12.0a"]);
    }
  });

  it("refuses a caveat that names nothing to wait for", () => {
    // The same refusal blockedRows makes. A caveat that says to
    // re-look one day, without saying at what, retires when somebody
    // feels like it, which is the state it was written to end.
    const text = [
      "- [x] 9.9 A row. **Started while the Phase 12 gate was shut: reasons.",
      "Re-look when the gate lifts.**",
    ].join(" ");
    expect(() => gateCaveats(text)).toThrow(/names nothing/);
  });

  it("says nothing while everything it waits on is open", () => {
    const text = [
      "- [ ] 8.1 Not done.",
      "- [x] 9.9 A row. **Started while the Phase 12 gate was shut: reasons. Re-look when the gate lifts: 8.1.**",
    ].join("\n");
    expect(ripeCaveats(text)).toEqual([]);
  });

  it("reports a caveat the moment one of its rows is ticked", () => {
    const text = [
      "- [x] 8.1 Done now.",
      "- [x] 9.9 A row. **Started while the Phase 12 gate was shut: reasons. Re-look when the gate lifts: 8.1.**",
    ].join("\n");
    expect(ripeCaveats(text)).toEqual([
      { id: "9.9", why: "8.1 has landed, so its constants need re-reading" },
    ]);
  });

  it("reports on the FIRST of several to land, not only on all of them", () => {
    // Waiting for every trigger would let the first one pass
    // unexamined, and the first is the one that changes the
    // instrument under a constant nobody has looked at since.
    const text = [
      "- [x] 8.1 Done now.",
      "- [ ] 8.2 Still open.",
      "- [x] 9.9 A row. **Started while the Phase 12 gate was shut: reasons. Re-look when the gate lifts: 8.1, 8.2.**",
    ].join("\n");
    expect(ripeCaveats(text).map((one) => one.id)).toEqual(["9.9"]);
  });

  it("is quiet on the ladder today, because neither row has landed", () => {
    const ripe = ripeCaveats(roadmap);
    expect(
      ripe,
      `these caveats are due a re-read: ${ripe
        .map((one) => `${one.id} ${one.why}`)
        .join("; ")}`,
    ).toEqual([]);
  });

  it("would fire the moment 12.0a is ticked", () => {
    // The whole point, against the real ladder. This fired for real
    // when 13.8b ticked on 10 September 2026 — the re-look was done
    // and written into each caveat the same day — and 12.0a, the
    // remaining named row, re-arms the same reminder.
    const landed = roadmap.replace("- [ ] 12.0a ", "- [x] 12.0a ");
    expect(
      ripeCaveats(landed)
        .map((one) => one.id)
        .sort(),
    ).toEqual(["12.14", "12.6", "12.9"]);
  });
});

// Roadmap 10.2c. Row 12.1 was marked BLOCKED by amendment 18 and
// RETIRED on the owner's ruling the next day, and for a moment it was
// both: a row saying it is waiting on something and a row saying there
// is nothing to wait for. BLOCKED was the right reading of a row that
// could not proceed and the wrong verdict on one that should not
// exist, and the difference matters to whoever reads the ladder
// looking for work.
describe("a retired row is not also a blocked one", () => {
  it("reports a row claiming both at once", () => {
    const text = "- [~] 9.9 RETIRED today. **BLOCKED: on something.**";
    expect(retiredWithBlocker(text)).toEqual(["9.9"]);
  });

  it("says nothing about a retired row with no marker", () => {
    expect(retiredWithBlocker("- [~] 9.9 RETIRED today, for reasons.")).toEqual(
      [],
    );
  });

  it("says nothing about an open row that is blocked", () => {
    // The ordinary case, and the one the marker is for.
    const text = "- [ ] 9.9 A row. **BLOCKED: on something named.**";
    expect(retiredWithBlocker(text)).toEqual([]);
  });

  it("says nothing about a ticked row carrying a caveat", () => {
    // The gate caveats of amendment 20 sit on TICKED rows and are not
    // blockers, so they must not be swept up by this.
    const text =
      "- [x] 9.9 Done. **Started while the Phase 12 gate was shut: reasons. Re-look when the gate lifts: 8.1.**";
    expect(retiredWithBlocker(text)).toEqual([]);
  });

  it("holds the ladder to it", () => {
    const both = retiredWithBlocker(roadmap);
    expect(
      both,
      `these rows are retired and blocked at once: ${both.join(", ")}`,
    ).toEqual([]);
  });
});

// Roadmap 10.0b11, amendment 21. The ladder ran out of rows this
// working environment can start, which is the state amendment 19
// predicted in writing and left unhandled: it said to say so in the
// sentence rather than to name a row that is not startable, and it
// said the sentence could never simply be deleted, but nothing let a
// reader express "none" at all.
//
// So emptiness gets a form. A declaration of nothing is a claim
// somebody made and can be disagreed with; a missing sentence is a
// file nobody finished. They must not look alike.
describe("the ladder that has nothing left to start", () => {
  it("accepts a declaration of nothing as the claim it is", () => {
    expect(
      startableClaims("NOTHING outside Phase 12 remains startable, because"),
    ).toEqual([]);
  });

  it("still refuses a ladder that simply says nothing", () => {
    expect(() => startableClaims("a ladder with no such sentence")).toThrow(
      /no sentence naming which rows remain startable/,
    );
  });

  it("tells a reader the form to use when nothing is startable", () => {
    // The refusal has to teach, or the next person deletes the
    // sentence again and this guard passes for the wrong reason.
    expect(() => startableClaims("nothing here")).toThrow(/NOTHING outside/);
  });

  it("prefers a real list when the ladder carries one", () => {
    const both =
      "NOTHING outside Phase 12 remains startable. Rows 9.4 remain " +
      "startable and are not marked.";
    expect(startableClaims(both)).toEqual(["9.4"]);
  });

  it("reads the real ladder's current claim, whatever shape it is in", () => {
    // Amendment 24's adversarially verified list, 12 September 2026:
    // eight whole rows with every clause satisfiable here and no
    // marker. Amendment 21's emptiness declaration is retired to past
    // tense in the same commit, so this is the ladder's ONE live
    // claim. This pins what the ladder actually says today, so
    // changing it is a deliberate edit to this line.
    expect(startableClaims(roadmap)).toEqual(["10.3", "14.3", "14.9a"]);
  });
});
