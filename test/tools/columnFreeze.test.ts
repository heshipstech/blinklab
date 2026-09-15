import { describe, expect, it } from "vitest";

import { CSV_COLUMNS } from "../../src/core/csv";
import {
  MANIFEST_PATH,
  freezeVerdict,
  frozenFields,
  liveColumns,
  parseManifest,
  readManifest,
  signatureBlock,
} from "../../tools/columnFreeze.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 12.17, the column-freeze manifest for the v2 corpus read.
// The tool and this test land now; the freeze itself is the OWNER's
// dated act, made later by signing fields into docs/column-freeze.txt.
// Until then the guard must hold NO constraint — and say so — because
// a constraint nobody signed would be this file inventing the owner's
// signature.

const root = repoRoot();

const MANIFEST = (signatures: string): string =>
  [
    "COLUMN FREEZE MANIFEST (test copy)",
    "",
    "An example line the parser must NOT read as a signature:",
    "",
    "  exampleField | signed in 1 January 2026",
    "",
    "SIGNATURES",
    "----------",
    signatures,
  ].join("\n");

describe("the parser reads signatures, and only signatures", () => {
  it("parses a sign-in, and a sign-in with a sign-out", () => {
    const entries = parseManifest(
      MANIFEST(
        [
          "  timestampMs | signed in 20 September 2026",
          "  perclos | signed in 20 September 2026 | signed out 3 October 2026",
        ].join("\n"),
      ),
    );
    expect(entries).toEqual([
      { field: "timestampMs", signedIn: "20 September 2026", signedOut: null },
      {
        field: "perclos",
        signedIn: "20 September 2026",
        signedOut: "3 October 2026",
      },
    ]);
  });

  it("ignores the example line above the SIGNATURES heading", () => {
    // The manifest's own prose shows the format with an example line.
    // A parser that read the whole file would count that example as a
    // real signature — the exact defect the caveat-block scoping in
    // detectorRatchet exists to prevent, applied here from birth.
    const entries = parseManifest(MANIFEST(""));
    expect(entries).toEqual([]);
  });

  it("returns nothing when the heading itself is gone", () => {
    expect(signatureBlock("no heading here")).toBe("");
    expect(parseManifest("exampleField | signed in 1 January 2026")).toEqual(
      [],
    );
  });
});

describe("the frozen set", () => {
  it("is the signed-in fields that were never signed out", () => {
    const text = MANIFEST(
      [
        "  timestampMs | signed in 20 September 2026",
        "  perclos | signed in 20 September 2026 | signed out 3 October 2026",
      ].join("\n"),
    );
    expect(frozenFields(text)).toEqual(["timestampMs"]);
  });
});

describe("the verdict truth table", () => {
  it("holds no constraint before the owner's first sign-in, and says so", () => {
    const verdict = freezeVerdict(MANIFEST(""), ["timestampMs"]);
    expect(verdict.ok).toBe(true);
    expect(verdict.why).toContain("no fields are signed in");
  });

  it("passes when every signed-in column is in the live header", () => {
    const verdict = freezeVerdict(
      MANIFEST("  timestampMs | signed in 20 September 2026"),
      ["timestampMs", "perclos"],
    );
    expect(verdict.ok, verdict.why).toBe(true);
  });

  it("refuses a signed-in column missing from the header, by name", () => {
    const verdict = freezeVerdict(
      MANIFEST("  apertureMm | signed in 20 September 2026"),
      ["timestampMs"],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("apertureMm");
    expect(verdict.why).toContain(MANIFEST_PATH);
  });

  it("lifts the constraint of a field the owner signed out", () => {
    // Self-retiring, the drozyGuard pattern: the field is gone from
    // the header AND signed out, so nothing is owed.
    const verdict = freezeVerdict(
      MANIFEST(
        "  retiredField | signed in 20 September 2026 | signed out 3 October 2026",
      ),
      ["timestampMs"],
    );
    expect(verdict.ok, verdict.why).toBe(true);
  });
});

describe("the reader itself", () => {
  it("parses the live header out of csv.ts exactly as the code exports it", () => {
    // The drozyGuard rule: a guard's own reader is held to the real
    // thing, so a reshaped CSV_COLUMNS literal cannot quietly empty
    // the watch and leave every verdict vacuously green.
    expect(liveColumns(root)).toEqual([...CSV_COLUMNS]);
  });
});

describe("the corpus runner is wired to the freeze", () => {
  it("asks for the verdict before anything expensive, and refuses on it", () => {
    // The verdict function is tested above; this pins that the runner
    // actually CALLS it, read from the runner's own source the way the
    // model-provenance pins read the engine — a guard the runner does
    // not consult is a manifest nobody enforces.
    const runner = readRepoFile("tools/measure_corpus.mjs", root);
    expect(runner).toContain('from "./columnFreeze.mjs"');
    expect(runner).toContain("freezeVerdict(readManifest(");
    expect(runner).toContain("console.error(freeze.why)");
  });
});

describe("the repository itself", () => {
  it("holds a manifest with its SIGNATURES heading and no signatures yet", () => {
    // No signatures is the committed truth of roadmap 12.17: the tool
    // lands now and the freeze is the owner's dated act, later. The
    // heading is asserted so a rewrite that dropped it would redden
    // here rather than silently unfreezing whatever had been signed.
    const text = readManifest(root);
    expect(signatureBlock(text)).not.toBe("");
    expect(parseManifest(text)).toEqual([]);
  });

  it("passes the freeze verdict on the live header today", () => {
    const verdict = freezeVerdict(readManifest(root), liveColumns(root));
    expect(verdict.ok, verdict.why).toBe(true);
  });
});
