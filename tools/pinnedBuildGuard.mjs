import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Roadmap 11.8a, the pinned build's paper half.
//
// Phase 15's evidence rows all lean on one promise: a run that becomes
// evidence names the exact build that produced it, and that build is a
// git tag anyone can check out. The promise dies quietest in prose —
// a plan writes "the frozen 27 August plan on the pinned build" and no
// machine ever asks WHICH build — so this guard holds the row's Check
// verbatim: every plan naming a build names a tag that EXISTS, and
// "frozen" appears in no plan without one.
//
// One dated ledger, the drozyGuard shape. Plans written before this
// row say "frozen" about their own text — a frozen PLAN, byte-frozen
// OUTPUT — not about a build, and editing a frozen plan to appease a
// guard would be the exact defect freezing exists to prevent. So the
// pre-pinning plans are named below, each with its reason, and the
// list may only shrink: the ledger exempts ONLY the frozen clause,
// never the tag rule, and a test pins its exact contents so an
// addition is a reviewed decision rather than a way to quiet the red.
//
// Same arrangement as columnFreeze, drozyGuard and resultGuard: plain
// .mjs reading the disk and git, verdicts as data, armed by its test.

/** Where the plans live. */
export const PLANS_DIR = "docs";

/**
 * Plans whose "frozen" predates roadmap 11.8a and refers to the plan's
 * own text rather than a build. Dated in, removable only.
 */
export const PRE_PINNING_FROZEN_PLANS = [
  // 15 September 2026: five uses of "frozen", all about round II's
  // frozen PLAN and the report's byte-frozen output, written before
  // the pinned-build row existed. Retires when the pilot's rows name
  // their build.
  "assessment-pilot-plan.md",
  // 15 September 2026: one "FROZEN for round I inputs" — the round II
  // rules frozen against round I's files, not a build claim. Found by
  // this guard's own case-insensitive read on its first run, after a
  // case-sensitive scout had missed it. Retires when round II names
  // its pinned build (roadmap 11.7 requires 11.8a's tag).
  "validation-plan-round2.md",
];

/** Every docs file with "plan" in its name, sorted. */
export function planFiles(repoDir) {
  return readdirSync(join(repoDir, PLANS_DIR))
    .filter((name) => name.includes("plan"))
    .sort();
}

/** The plans with their text, ready for the verdict. */
export function readPlans(repoDir) {
  return planFiles(repoDir).map((name) => ({
    name,
    text: readFileSync(join(repoDir, PLANS_DIR, name), "utf8"),
  }));
}

/** Every tag the repository carries, one honest source. */
export function gitTags(repoDir) {
  return execFileSync("git", ["tag"], { cwd: repoDir, encoding: "utf8" })
    .split("\n")
    .filter((line) => line.length > 0);
}

/**
 * The build names a plan text carries: vMAJOR.MINOR.PATCH tokens,
 * unique, in order of first appearance. The project's tags are the
 * only things spelled that way in a plan, so the token IS the claim.
 */
export function namedBuilds(text) {
  return [...new Set(text.match(/\bv\d+\.\d+\.\d+\b/g) ?? [])];
}

/** Whether a plan says "frozen", whole word, any case. */
export function saysFrozen(text) {
  return /\bfrozen\b/i.test(text);
}

/**
 * The Check, as data. A plan naming a build whose tag does not exist
 * is a violation by both names; a plan saying "frozen" while naming no
 * build is a violation unless it is in the pre-pinning ledger; and a
 * clean pass says what it checked, never passing silently.
 */
export function pinnedBuildVerdict(plans, tags) {
  const violations = [];
  for (const plan of plans) {
    const builds = namedBuilds(plan.text);
    for (const build of builds) {
      if (!tags.includes(build)) {
        violations.push(
          `${plan.name} names build ${build}, and no such git tag exists`,
        );
      }
    }
    if (
      saysFrozen(plan.text) &&
      builds.length === 0 &&
      !PRE_PINNING_FROZEN_PLANS.includes(plan.name)
    ) {
      violations.push(
        `${plan.name} says "frozen" without naming the build it is frozen against`,
      );
    }
  }
  if (violations.length > 0) {
    return { ok: false, why: violations.join("; ") };
  }
  return {
    ok: true,
    why: `checked ${String(plans.length)} plans against ${String(tags.length)} tags: every named build is a real tag, and no un-ledgered plan says "frozen" without one`,
  };
}
