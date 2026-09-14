// Types for the plain JavaScript guard next door. Same arrangement as
// bundleGuard, exportGuard, claimGuard and resultGuard: the guard stays
// .mjs because it reads the disk and shells out to git, and its callers
// are type checked, because an untyped import makes every result `any`,
// which is how a guard silently stops guarding.

/** The file whose output the DROZY caveat is about. */
export const SHAPE_SOURCE: string;

/** The published feature label for each field of BlinkShape. */
export const SHAPE_FEATURE_LABELS: Record<string, string>;

/** Every published DROZY feature and the sources that produce it. */
export const FEATURE_SOURCES: Record<string, string[]>;

/** The feature names out of the PRIMARY table, in row order. Throws if gone. */
export function publishedFeatures(resultText: string): string[];

/** The features whose sources moved since the given commit. */
export function movedFeatures(sinceSha: string, root: string): string[];

/** Mapped sources naming no file in the repository, as "feature -> source". */
export function missingSources(root: string): string[];

/** Where each document's caveat block begins. */
export const CAVEAT_MARKERS: Record<string, string>;

/** The caveat block from the marker to the blank line ending it, or null if gone. */
export function caveatBlock(doc: string, marker: string): string | null;

/** The commit the DROZY result file says its numbers were built from. Throws if absent. */
export function parseMeasuringCommit(text: string): string;

/** The field names of the BlinkShape type, read from the source. Throws if absent. */
export function shapeFieldNames(source: string): string[];

/** Whether a commit is present in this checkout at all. */
export function commitExists(sha: string, root: string): boolean;

/** Whether the commit is an ancestor of HEAD. */
export function isAncestorOfHead(sha: string, root: string): boolean;

/** Short hashes of commits touching the path since the given commit, newest first. */
export function commitsTouchingSince(
  relativePath: string,
  sinceSha: string,
  root: string,
): string[];
