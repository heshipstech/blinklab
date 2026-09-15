import { describe, expect, it } from "vitest";

import {
  PRE_PINNING_FROZEN_PLANS,
  gitTags,
  namedBuilds,
  pinnedBuildVerdict,
  planFiles,
  readPlans,
  saysFrozen,
} from "../../tools/pinnedBuildGuard.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 11.8a, the pinned build's paper half: the commit of any run
// that becomes evidence is tagged, the frozen plan names the build,
// and this guard holds the Check's second clause — every plan naming
// a build names a tag that EXISTS in git, and "frozen" appears in no
// plan without one. The tags themselves are the owner's act at
// evidence time; today no plan names a build and exactly one plan
// says "frozen" about its own text rather than a build, so the guard
// lands the columnFreeze way: the rule armed, the ledger explicit,
// nothing owed yet.

const root = repoRoot();

describe("the readers", () => {
  it("treats vMAJOR.MINOR.PATCH tokens as named builds, uniquely", () => {
    expect(
      namedBuilds("pinned to v1.2.3, reproduced on v1.2.3, then v2.0.0"),
    ).toEqual(["v1.2.3", "v2.0.0"]);
    expect(namedBuilds("no builds are named here")).toEqual([]);
  });

  it("reads 'frozen' as a whole word, any case", () => {
    expect(saysFrozen("the FROZEN plan")).toBe(true);
    expect(saysFrozen("byte-frozen output")).toBe(true);
    expect(saysFrozen("frozenness is not the word")).toBe(false);
  });

  it("watches every docs file with 'plan' in its name", () => {
    const files = planFiles(root);
    expect(files).toContain("assessment-pilot-plan.md");
    expect(files).toContain("validation-plan-round2.md");
    for (const file of files) {
      expect(file).toMatch(/plan/);
    }
  });
});

describe("the verdict truth table", () => {
  const tags = ["v0.1.0", "v0.2.0"];

  it("passes a plan that names an existing tag", () => {
    const verdict = pinnedBuildVerdict(
      [{ name: "a-plan.md", text: "frozen against build v0.1.0" }],
      tags,
    );
    expect(verdict.ok, verdict.why).toBe(true);
  });

  it("refuses a plan naming a build no tag carries, by both names", () => {
    const verdict = pinnedBuildVerdict(
      [{ name: "a-plan.md", text: "the run uses v9.9.9" }],
      tags,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("a-plan.md");
    expect(verdict.why).toContain("v9.9.9");
  });

  it("refuses a frozen plan that names no build at all", () => {
    const verdict = pinnedBuildVerdict(
      [{ name: "a-plan.md", text: "this plan is frozen" }],
      tags,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("frozen");
    expect(verdict.why).toContain("a-plan.md");
  });

  it("holds no frozen constraint over a ledgered pre-pinning plan", () => {
    // The ledger is for plans whose "frozen" predates 11.8a and means
    // the plan's own text, not a build. It exempts ONLY the frozen
    // clause: a ledgered plan that starts naming builds is held to
    // the tag rule like any other.
    const verdict = pinnedBuildVerdict(
      [
        {
          name: "assessment-pilot-plan.md",
          text: "the frozen plan and its byte-frozen output",
        },
      ],
      tags,
    );
    expect(verdict.ok, verdict.why).toBe(true);
    const withBadBuild = pinnedBuildVerdict(
      [
        {
          name: "assessment-pilot-plan.md",
          text: "frozen, and pinned to v9.9.9",
        },
      ],
      tags,
    );
    expect(withBadBuild.ok).toBe(false);
  });

  it("says why when nothing is owed, never passing silently", () => {
    const verdict = pinnedBuildVerdict(
      [{ name: "a-plan.md", text: "no builds are named, nothing is claimed" }],
      tags,
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.why.length).toBeGreaterThan(0);
  });
});

describe("the ledger is a conscious act", () => {
  it("holds exactly the plans whose 'frozen' predates the pinning row", () => {
    // Adding a name here must be a reviewed decision with a dated
    // reason in the module, never a way to quiet the guard. The second
    // entry is the guard's own first catch: an uppercase "FROZEN" a
    // case-sensitive scout had missed.
    expect(PRE_PINNING_FROZEN_PLANS).toEqual([
      "assessment-pilot-plan.md",
      "validation-plan-round2.md",
    ]);
  });

  it("names only plans that exist, so a retired plan retires its entry", () => {
    const files = planFiles(root);
    for (const entry of PRE_PINNING_FROZEN_PLANS) {
      expect(files).toContain(entry);
    }
  });
});

describe("the repository itself", () => {
  it("carries real tags for the rule to check against", () => {
    expect(gitTags(root).length).toBeGreaterThan(0);
  });

  it("passes the verdict today: no plan names a build, one ledgered freeze", () => {
    const verdict = pinnedBuildVerdict(readPlans(root), gitTags(root));
    expect(verdict.ok, verdict.why).toBe(true);
  });
});
