// Types for the plain JavaScript guard next door. Same arrangement as
// bundleGuard and exportGuard: the guard stays .mjs because it shells
// out to git, and its callers are type checked, because an untyped
// import makes every result `any`, which is how a guard silently stops
// guarding.

/** A claim this repository is no longer allowed to make. */
export type RetiredClaim = {
  /**
   * The family of wordings, as a POSIX extended regular expression,
   * matched case insensitively. A fixed string bans one spelling and
   * lets the same claim back in one word away.
   */
  pattern: string;
  /** One wording of it, so a failure message can quote something real. */
  says: string;
  /** Why it is false, so a failure explains itself. */
  because: string;
};

/** A retired claim that has come back, and where. */
export type Relapse = {
  phrase: string;
  because: string;
  files: string[];
};

export const RETIRED_CLAIMS: readonly RetiredClaim[];

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot(): string;

/** Every file matching the pattern, tracked or newly added, case insensitive. */
export function trackedFilesMatching(pattern: string, root: string): string[];

/** Every retired claim that has come back, with the files it came back in. */
export function relapses(root: string, exempt?: string[]): Relapse[];
