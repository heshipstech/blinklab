// Types for the plain JavaScript generator next door. Same arrangement
// as resultsBlock and the guards: the generator stays .mjs because it
// reads the disk, and its callers are type checked.

/** An exact sentence a claim rests on, and the document it lives in. */
export type ClaimPin = {
  quote: string;
  path: string;
};

/** One cannot-see claim with the documents that prove it. */
export type CannotSeeSource = {
  claim: string;
  source: string;
  pins: ClaimPin[];
};

/** The claims that carry no pin at all, by their opening words. */
export function claimsWithoutPins(claims: CannotSeeSource[]): string[];

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
