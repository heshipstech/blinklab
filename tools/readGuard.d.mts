// Types for the plain JavaScript read-in-full tool next door. Same
// arrangement as the other guards: the tool stays .mjs because it
// reads the disk, and its callers are type checked.

export const READ_IN_FULL_DOCS: readonly string[];

/** The document reduced to the claims a reader would check. */
export function claimText(docText: string): string;

/** A short digest of a document's claims, for the stamp to carry. */
export function claimDigest(docText: string): string;

/** The read-in-full stamp a document carries, or null. */
export function readInFullStamp(docText: string): {
  date: string;
  digest: string;
} | null;

/** Documents whose claims changed since their last full read. */
export function staleReads(root: string): {
  name: string;
  stamped: string;
  now: string;
  date: string;
}[];
