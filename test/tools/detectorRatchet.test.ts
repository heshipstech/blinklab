import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DETECTOR_SOURCES,
  STALE_MARKER,
  builtFromSha,
  commitsTouchingSince,
  ratchetVerdict,
} from "../../tools/detectorRatchet.mjs";
import {
  isShallowRepo,
  readRepoFile,
  repoRoot,
  runningInCi,
} from "../../tools/resultGuard.mjs";

// Roadmap 10.1a, the detector-change measurement ratchet. The published
// Eyeblink8 numbers are true of the commit that measured them, and
// nothing else. Twice now this project wrote correct numbers and let
// the code move on underneath; the fix each time was prose, and prose
// rots. This guard binds docs/eyeblink8-result.txt to the code with a
// "Built from commit" line: touch a detector source without either
// re-measuring or writing the dated DETECTOR CHANGED caveat, and the
// build goes red — and once the numbers ARE re-measured, a lingering
// "not yet re-measured" caveat is itself a false sentence and goes red
// from the other side. Self-retiring, both ways.

const root = repoRoot();

const FRESH_TEXT = [
  "Recall 83.6%",
  "Built from commit " + "a".repeat(40),
  "history below",
].join("\n");

const STALE_TEXT = [
  "Recall 83.6%",
  "Built from commit " + "a".repeat(40),
  `${STALE_MARKER}, 5 September 2026:`,
  "  1234567 feat: the detector reads a person's own guided blink line",
].join("\n");

const TOUCHING = [
  {
    sha: "1234567890abcdef1234567890abcdef12345678",
    subject: "feat: the detector reads a person's own guided blink line",
  },
];

describe("parsing the ratchet's anchor out of the result file", () => {
  it("finds the built-from commit", () => {
    expect(builtFromSha(FRESH_TEXT)).toBe("a".repeat(40));
  });

  it("returns null when the line is absent", () => {
    expect(builtFromSha("Recall 83.6%\nno anchor here")).toBeNull();
  });

  it("ignores a short hash: only a full 40-character sha anchors", () => {
    expect(builtFromSha("Built from commit abc1234")).toBeNull();
  });
});

describe("the verdict truth table", () => {
  it("fails a result file with no built-from line at all", () => {
    const verdict = ratchetVerdict("Recall 83.6%", []);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("Built from commit");
  });

  it("passes fresh numbers with no caveat", () => {
    expect(ratchetVerdict(FRESH_TEXT, []).ok).toBe(true);
  });

  it("fails a caveat standing on a fresh measurement", () => {
    // "Not yet re-measured" beside a moved built-from line claims an
    // outstanding change that does not exist.
    const verdict = ratchetVerdict(STALE_TEXT, []);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("fresh");
  });

  it("fails a touched detector with no caveat, naming the commit", () => {
    const verdict = ratchetVerdict(FRESH_TEXT, TOUCHING);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("1234567");
    expect(verdict.why).toContain(STALE_MARKER);
  });

  it("passes a touched detector whose caveat names every commit", () => {
    expect(ratchetVerdict(STALE_TEXT, TOUCHING).ok).toBe(true);
  });

  it("fails a caveat that misses one of the touching commits", () => {
    const twoTouching = [
      ...TOUCHING,
      {
        sha: "feedfacefeedfacefeedfacefeedfacefeedface",
        subject: "feat: another detector change",
      },
    ];
    const verdict = ratchetVerdict(STALE_TEXT, twoTouching);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("feedfac");
  });
});

describe("the source list is real", () => {
  it("every detector source the ratchet watches exists on disk", () => {
    // A rename would otherwise silently drop a file out of the watch:
    // git log on a path that no longer exists returns nothing, forever
    // fresh. The list must move with the code or go red.
    for (const file of DETECTOR_SOURCES) {
      expect(existsSync(join(root, file)), `${file} is gone`).toBe(true);
    }
  });
});

describe("the repository itself", () => {
  it("holds a coherent ratchet right now", () => {
    if (isShallowRepo(root)) {
      // A shallow checkout cannot walk built-from..HEAD. Safe to skip
      // only because resultGuard's CI pin makes a shallow CI a failure.
      return;
    }
    const text = readRepoFile("docs/eyeblink8-result.txt", root);
    const sha = builtFromSha(text);
    expect(sha, "the result file has lost its built-from line").not.toBeNull();
    const touching = commitsTouchingSince(sha as string, root);
    const verdict = ratchetVerdict(text, touching);
    expect(verdict.ok, verdict.why).toBe(true);
  });

  it("runs with full history in CI, so the ratchet cannot vanish", () => {
    if (runningInCi()) {
      expect(isShallowRepo(root)).toBe(false);
    }
  });
});
