import { describe, expect, it } from "vitest";

import {
  STALE_MARKER,
  builtFromSha,
  commitsTouchingSince,
  missingSources,
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
    expect(missingSources(root)).toEqual([]);
  });
});

describe("a caveat survives the rebase merge that rewrites its sha", () => {
  // Roadmap 10.10c4c. The trap this closes cost a red main.
  //
  // This repository merges by rebase, so a commit's sha on a branch is
  // not its sha on main. A caveat written in a pull request can only
  // name the branch sha, which stops existing the moment the pull
  // request lands — so the ratchet went green on the branch and red on
  // main, for every change that touches a detector source. The result
  // file had already noticed this in prose: "a rebase merge does not
  // let this pull request know in advance".
  //
  // The subject survives the rebase. Matching on EITHER the sha prefix
  // or the exact subject keeps the guard's whole purpose — a detector
  // change must be declared in writing — while letting the declaration
  // be written before the sha it will end up with is known.

  const caveat = (body: string): string =>
    `Built from commit ${"a".repeat(40)}\n\n${STALE_MARKER}, 1 January:\n${body}`;

  it("accepts a caveat naming the sha, as it always did", () => {
    const verdict = ratchetVerdict(caveat("  1234567 feat: something"), [
      { sha: "1234567890abcdef", subject: "feat: something" },
    ]);
    expect(verdict.ok, verdict.why).toBe(true);
  });

  it("accepts a caveat naming the subject when the sha has moved", () => {
    // The rebase case: the caveat was written against the branch sha
    // and the commit now has another.
    const verdict = ratchetVerdict(caveat("  feat: something"), [
      { sha: "fedcba0987654321", subject: "feat: something" },
    ]);
    expect(verdict.ok, verdict.why).toBe(true);
  });

  it("still refuses a caveat that names neither", () => {
    // The guard is not weakened: an undeclared detector change is
    // still red, and a caveat about some other commit does not count.
    const verdict = ratchetVerdict(caveat("  feat: something else"), [
      { sha: "fedcba0987654321", subject: "feat: something" },
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("does not name");
  });

  it("does not accept an empty subject as naming anything", () => {
    // A commit with no subject would otherwise match every caveat,
    // because every string contains the empty string.
    const verdict = ratchetVerdict(caveat("  nothing to do with it"), [
      { sha: "fedcba0987654321", subject: "" },
    ]);
    expect(verdict.ok).toBe(false);
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
