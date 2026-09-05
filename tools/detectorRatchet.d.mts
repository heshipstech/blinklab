// Types for the plain JavaScript ratchet next door. Same arrangement
// as resultGuard, claimGuard and learningGuard: the guard stays .mjs
// because it reads the disk and git, and its callers are type checked,
// because an untyped import makes every verdict `any`, which is how a
// guard silently stops guarding.

/** The modules whose change can move the published corpus numbers. */
export const DETECTOR_SOURCES: string[];

/** The exact caveat phrase the guard keys on. */
export const STALE_MARKER: string;

/** The ratchet's anchor: the full sha the result file names, or null. */
export function builtFromSha(resultText: string): string | null;

/** Watched files that no longer exist on disk (a rename slipping the watch). */
export function missingSources(root: string): string[];

/** A commit that touched a detector source after the anchor. */
export type TouchingCommit = { sha: string; subject: string };

/** Every commit after the anchor that touched a detector source. */
export function commitsTouchingSince(
  sha: string,
  root: string,
): TouchingCommit[];

/** The verdict, as data rather than an exit code. */
export function ratchetVerdict(
  resultText: string,
  touching: TouchingCommit[],
): { ok: boolean; why: string };
