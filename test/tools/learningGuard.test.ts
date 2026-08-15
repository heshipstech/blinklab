import { describe, expect, it } from "vitest";

import {
  touchesLearning,
  touchesSource,
  verdict,
  waiverReason,
} from "../../tools/learningGuard.mjs";

// Remediation F1. The Definition of Done said every increment teaches
// one concept into LEARNING.md. It held for a hundred and thirty pull
// requests on intent alone, lapsed at #134, and nobody noticed for
// weeks. LEARNING 0.6 in this repository is an essay called
// "conventions become mechanisms"; this is that essay applied to
// itself.

const SRC = ["src/core/blink.ts"];
const DOCS = ["README.md", "docs/log.md"];

describe("what counts as an increment", () => {
  it("is any change under src/", () => {
    expect(touchesSource(SRC)).toBe(true);
    expect(touchesSource(DOCS)).toBe(false);
    expect(touchesSource([])).toBe(false);
  });

  it("does not mistake a path that merely contains src for one under it", () => {
    expect(touchesSource(["docs/src-notes.md"])).toBe(false);
    expect(touchesSource(["analysis/src/thing.py"])).toBe(false);
  });

  it("recognises the learning record by exact path", () => {
    expect(touchesLearning(["LEARNING.md"])).toBe(true);
    expect(touchesLearning(["docs/LEARNING.md"])).toBe(false);
  });
});

describe("the waiver", () => {
  it("reads the reason out of a commit message", () => {
    expect(
      waiverReason(["fix: rename\n\nNo LEARNING entry: mechanical rename"]),
    ).toBe("mechanical rename");
  });

  it("is case insensitive on the marker but keeps the reason verbatim", () => {
    expect(waiverReason(["no learning entry: Dependency bump"])).toBe(
      "Dependency bump",
    );
  });

  it("refuses the marker with no reason after it", () => {
    // The shape of a reason is not a reason. Accepting the bare marker
    // would turn the escape hatch into the loophole this guard exists
    // to avoid.
    expect(waiverReason(["No LEARNING entry:"])).toBeNull();
    expect(waiverReason(["No LEARNING entry:   "])).toBeNull();
  });

  it("finds the reason in any commit of the range, not only the first", () => {
    expect(
      waiverReason(["first commit", "second\n\nNo LEARNING entry: a revert"]),
    ).toBe("a revert");
  });

  it("is null when nobody said anything", () => {
    expect(waiverReason(["ordinary commit message"])).toBeNull();
  });
});

describe("the verdict", () => {
  it("passes a change that touches no source", () => {
    expect(verdict(DOCS, ["docs only"]).ok).toBe(true);
  });

  it("passes source plus a learning entry", () => {
    expect(verdict([...SRC, "LEARNING.md"], ["feat: a thing"]).ok).toBe(true);
  });

  it("passes source with a stated reason for no entry", () => {
    const result = verdict(SRC, [
      "chore\n\nNo LEARNING entry: mechanical rename",
    ]);
    expect(result.ok).toBe(true);
    expect(result.why).toContain("mechanical rename");
  });

  it("FAILS source with neither, which is the case that lapsed", () => {
    const result = verdict(SRC, ["feat: a thing with no lesson recorded"]);
    expect(result.ok).toBe(false);
    // The message has to say what to do, or a red build is a puzzle.
    expect(result.why).toContain("No LEARNING entry:");
  });

  it("explains itself on the passing paths too", () => {
    // A guard that is silent when it passes gives a reader no way to
    // tell "checked and fine" from "never ran".
    for (const files of [DOCS, [...SRC, "LEARNING.md"]]) {
      expect(verdict(files, ["m"]).why.length).toBeGreaterThan(0);
    }
  });
});
