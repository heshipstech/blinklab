// Types for the plain JavaScript guard next door. Same arrangement as
// bundleGuard and exportGuard: the guard stays .mjs because it shells
// out to git, and its callers are type checked, because an untyped
// import makes every result `any`, which is how a guard silently stops
// guarding.

/** A claim this repository is no longer allowed to make. */
export type RetiredClaim = {
  /** The exact wording, matched case insensitively. */
  phrase: string;
  /** Why it is false, so a failure explains itself. */
  because: string;
};

/** A retired claim that has come back, and where. */
export type Relapse = RetiredClaim & { files: string[] };

export const RETIRED_CLAIMS: readonly RetiredClaim[];

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot(): string;

/** Every tracked file containing the phrase, case insensitive. */
export function trackedFilesContaining(phrase: string, root: string): string[];

/** Every retired claim that has come back, with the files it came back in. */
export function relapses(root: string, exempt?: string[]): Relapse[];
