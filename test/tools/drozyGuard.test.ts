import { describe, expect, it } from "vitest";

import {
  isShallowRepo,
  readRepoFile,
  repoRoot,
  runningInCi,
} from "../../tools/resultGuard.mjs";
import {
  CAVEAT_MARKERS,
  SHAPE_FEATURE_LABELS,
  SHAPE_SOURCE,
  caveatBlock,
  commitExists,
  commitsTouchingSince,
  isAncestorOfHead,
  parseMeasuringCommit,
  shapeFieldNames,
} from "../../tools/drozyGuard.mjs";

// NEEDS-REVIEW.md section 3: the published DROZY correlations were
// measured on 9 August 2026, and PR #225 changed the blink shape window
// on 12 August. Three of the seven published features come out of
// blinkShape.ts, and they are the same three the verdict calls
// suggestive and unconfirmed.
//
// The point of these tests is not that a warning paragraph exists. It
// is that the warning is required exactly while git says it is true,
// and stops being required the moment somebody re-measures. A caveat
// nobody can forget to write is worth more than one nobody remembers to
// delete.

const root = repoRoot();
const resultFile = readRepoFile("docs/drozy-result.txt", root);
const readme = readRepoFile("README.md", root);
const shapeSource = readRepoFile(SHAPE_SOURCE, root);

const measuringCommit = parseMeasuringCommit(resultFile);

describe("the DROZY result file says which code produced it", () => {
  it("names a measuring commit", () => {
    expect(measuringCommit).toMatch(/^[0-9a-f]{7,40}$/);
  });

  it("refuses a result file that stopped saying, rather than skipping", () => {
    // Silent success is this project's recurring defect. A result file
    // with the provenance line deleted must fail loudly, not pass.
    expect(() => parseMeasuringCommit("DROZY, some numbers\n")).toThrow(
      /built from/,
    );
  });

  it("README's caveat names the same commit, so the two cannot drift apart", () => {
    const block = caveatBlock(readme, CAVEAT_MARKERS["README.md"] ?? "");
    expect(block).not.toBeNull();
    expect(block).toContain(measuringCommit);
  });
});

describe("caveatBlock reads the block, not the whole file", () => {
  it("stops at the blank line that ends the block", () => {
    expect(caveatBlock("intro\n\nMARK one two\nthree\n\nafter", "MARK")).toBe(
      "MARK one two\nthree",
    );
  });

  it("returns null when the marker is gone", () => {
    expect(caveatBlock("nothing here", "MARK")).toBeNull();
  });

  it("does not see a word that only appears elsewhere in the file", () => {
    // The hole this closes: README names "closing velocity" in its
    // feature list, so a whole-document search would still pass with
    // the caveat deleted.
    const doc = "closing velocity\n\nMARK the caveat\n\ntail";
    expect(caveatBlock(doc, "MARK")).not.toContain("closing velocity");
  });
});

describe("the shape columns the caveat is about", () => {
  it("every field of BlinkShape has a published feature label", () => {
    // If a fourth shape column is ever added, this fails until somebody
    // decides what DROZY's caveat should say about it. That decision is
    // the whole point: a new column measured by new code would need the
    // same treatment as the three that already have it.
    const fields = shapeFieldNames(shapeSource);
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(
        SHAPE_FEATURE_LABELS[field],
        `BlinkShape.${field} has no published feature label`,
      ).toBeDefined();
    }
  });

  it("refuses a source it cannot parse", () => {
    expect(() => shapeFieldNames("export type Something = {}")).toThrow(
      /BlinkShape/,
    );
  });
});

describe("the caveat is required while git says it is true", () => {
  it("the measuring commit is really in this history", () => {
    if (isShallowRepo(root)) {
      return;
    }
    expect(commitExists(measuringCommit, root)).toBe(true);
    expect(isAncestorOfHead(measuringCommit, root)).toBe(true);
  });

  it("runs with full history in CI, so this check cannot quietly vanish", () => {
    // Same pin as the stamp guard. A shallow checkout would skip every
    // git-based test below and report green, which is the failure mode
    // this repository keeps rediscovering.
    if (runningInCi()) {
      expect(isShallowRepo(root)).toBe(false);
    }
  });

  it("both documents carry the caveat while the shape code has moved since", () => {
    if (isShallowRepo(root)) {
      return;
    }
    const moved = commitsTouchingSince(SHAPE_SOURCE, measuringCommit, root);
    if (moved.length === 0) {
      // Self-retiring: once DROZY is re-measured on current code and
      // the "built from" line is updated, nothing here is required.
      return;
    }
    for (const [name, doc] of [
      ["docs/drozy-result.txt", resultFile],
      ["README.md", readme],
    ] as const) {
      const block = caveatBlock(doc, CAVEAT_MARKERS[name] ?? "");
      expect(
        block,
        `${name} has no caveat block, but ${SHAPE_SOURCE} has moved since ${measuringCommit} (${moved.join(", ")})`,
      ).not.toBeNull();
      for (const label of Object.values(SHAPE_FEATURE_LABELS)) {
        expect(
          block?.includes(label),
          `${name}'s caveat must name "${label}"`,
        ).toBe(true);
      }
      expect(
        block?.toLowerCase().includes("not been recomputed"),
        `${name}'s caveat must say the affected rows were not recomputed`,
      ).toBe(true);
    }
  });
});
