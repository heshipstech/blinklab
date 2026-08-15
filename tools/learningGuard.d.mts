// Types for the plain JavaScript guard next door. Same arrangement as
// the other guards: the guard stays .mjs because it shells out to git,
// and its callers are type checked, because an untyped import makes
// every result `any`, which is how a guard silently stops guarding.

/** The verdict, as data rather than as an exit code. */
export type LearningVerdict = {
  ok: boolean;
  why: string;
};

/** Whether any changed file sits under src/. */
export function touchesSource(changedFiles: readonly string[]): boolean;

/** Whether LEARNING.md is among the changed files. */
export function touchesLearning(changedFiles: readonly string[]): boolean;

/** The stated reason for skipping an entry, or null if none was given. */
export function waiverReason(commitMessages: readonly string[]): string | null;

/** Whether this change satisfies the Definition of Done, and why. */
export function verdict(
  changedFiles: readonly string[],
  commitMessages: readonly string[],
): LearningVerdict;

/** Files changed between a base commit and HEAD. */
export function changedFilesSince(baseSha: string, root: string): string[];

/** Commit messages between a base commit and HEAD. */
export function commitMessagesSince(baseSha: string, root: string): string[];
