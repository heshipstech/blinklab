import { describe, expect, it } from "vitest";

import {
  READ_IN_FULL_DOCS,
  claimText,
  readInFullStamp,
  staleReads,
} from "../../tools/readGuard.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.0b6, ladder B14's stamp half. The existing stamp says a
// document was TOUCHED. This one says it was READ, which is a
// different act and the one the September audit's findings actually
// needed: five sentences that were each true when written and false
// when read, in documents somebody had edited many times since.
//
// A revised-stamp cannot catch that, because every edit bumps it. So
// this stamp is held to the document's CLAIM TEXT: the prose with its
// generated blocks and its count figures normalised away. A number
// the machine updated is not something a human read would have
// caught, and a gate that fires on every count bump becomes a rubber
// stamp inside a week. A changed sentence is different, and that is
// what goes stale here.

const root = repoRoot();

describe("normalising a document down to its claims", () => {
  it("drops a generated block, markers and all", () => {
    expect(
      claimText(
        "before\n<!-- status:begin -->\nnumbers\n<!-- status:end -->\nafter\n",
      ),
    ).toBe("before\nafter");
  });

  it("drops every generated block, not only the first", () => {
    const doc =
      "a\n<!-- results:begin -->\nx\n<!-- results:end -->\nb\n" +
      "<!-- privacy:begin -->\ny\n<!-- privacy:end -->\nc\n";
    expect(claimText(doc)).toBe("a\nb\nc");
  });

  it("normalises a count so a bumped figure is not a changed claim", () => {
    expect(claimText("That is 1347 unit tests, all green.")).toBe(
      claimText("That is 1402 unit tests, all green."),
    );
  });

  it("does NOT normalise a changed sentence", () => {
    expect(claimText("Phases 0 through 9 are complete.")).not.toBe(
      claimText("Phases 0 through 10 are complete."),
    );
  });

  it("drops the stamp line itself, so stamping is not a claim change", () => {
    expect(
      claimText(
        "words\n\nRead in full on 7 September 2026, claims a1b2c3d4.\n",
      ),
    ).toBe(claimText("words\n"));
  });
});

describe("reading the stamp a document carries", () => {
  it("takes the date and the digest it was made against", () => {
    expect(
      readInFullStamp("Read in full on 7 September 2026, claims `a1b2c3d4`."),
    ).toEqual({ date: "2026-09-07", digest: "a1b2c3d4" });
  });

  it("returns null when there is no such stamp", () => {
    expect(readInFullStamp("Written 9 August 2026.")).toBeNull();
  });

  it("refuses a stamp whose digest is missing rather than reporting the date alone", () => {
    // A date with no digest is a claim nobody can check. Reporting it
    // would let a document say it was read and never go stale.
    expect(() => readInFullStamp("Read in full on 7 September 2026.")).toThrow(
      /digest/,
    );
  });
});

describe("the repository's own reads", () => {
  it("names the documents a reader treats as a current description", () => {
    // STATE.md and LEARNING.md are deliberately absent. They are
    // append-only logs: an old entry does not become false when a new
    // one lands, so demanding a full re-read on every append would
    // make the stamp a formality within a week.
    expect(READ_IN_FULL_DOCS).not.toContain("STATE.md");
    expect(READ_IN_FULL_DOCS).not.toContain("LEARNING.md");
    expect(READ_IN_FULL_DOCS).toContain("README.md");
    expect(READ_IN_FULL_DOCS).toContain("MODEL_CARD.md");
  });

  it("every named document carries a read-in-full stamp", () => {
    for (const name of READ_IN_FULL_DOCS) {
      expect(
        readInFullStamp(readRepoFile(name, root)),
        `${name} has no read-in-full stamp`,
      ).not.toBeNull();
    }
  });

  it("no claim has changed since it was last read", () => {
    const stale = staleReads(root);
    expect(
      stale,
      stale.length === 0
        ? ""
        : `claims changed since the last full read: ${stale
            .map(
              (one) => `${one.name} (stamped ${one.stamped}, now ${one.now})`,
            )
            .join(", ")}. Read the document end to end, then bump its stamp.`,
    ).toEqual([]);
  });
});
