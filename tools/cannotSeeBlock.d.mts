// Types for the plain JavaScript generator next door. Same arrangement
// as resultsBlock and the guards: the generator stays .mjs because it
// reads the disk, and its callers are type checked.

/** One cannot-see claim with the documents that prove it. */
export type CannotSeeSource = {
  claim: string;
  source: string;
};

/**
 * Assert a quoted sentence exists in its source, whitespace-collapsed
 * on both sides. Throws, naming the source path, when the pin fails.
 */
export function assertQuote(
  sourceText: string,
  quote: string,
  sourcePath: string,
): void;

/** The claims, freshly derived from the source documents. Throws on any missing pin or number. */
export function buildCannotSeeClaims(root: string): CannotSeeSource[];

/** The whole generated module, byte for byte what src/core/cannotSee.ts must contain. */
export function buildCannotSeeModule(root: string): string;
