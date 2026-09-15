// Types for the plain JavaScript guard next door. Same arrangement as
// columnFreeze, drozyGuard and resultGuard: the guard stays .mjs
// because it reads the disk and git, and its callers are type checked,
// because an untyped import makes every result `any`, which is how a
// guard silently stops guarding.

/** Where the plans live: docs. */
export const PLANS_DIR: string;

/** Plans whose "frozen" predates roadmap 11.8a and means the plan's
 * own text, not a build. Dated in the module, removable only. */
export const PRE_PINNING_FROZEN_PLANS: readonly string[];

/** One plan, name and text, ready for the verdict. */
export type Plan = {
  name: string;
  text: string;
};

/** The verdict, as data rather than an exit code. */
export type PinnedBuildVerdict = {
  ok: boolean;
  why: string;
};

/** Every docs file with "plan" in its name, sorted. */
export function planFiles(repoDir: string): string[];

/** The plans with their text. */
export function readPlans(repoDir: string): Plan[];

/** Every tag the repository carries. */
export function gitTags(repoDir: string): string[];

/** The vMAJOR.MINOR.PATCH tokens a plan text carries, unique. */
export function namedBuilds(text: string): string[];

/** Whether a plan says "frozen", whole word, any case. */
export function saysFrozen(text: string): boolean;

/** The Check as data: named builds must be real tags, and "frozen"
 * appears in no un-ledgered plan without one. */
export function pinnedBuildVerdict(
  plans: readonly Plan[],
  tags: readonly string[],
): PinnedBuildVerdict;
