// Types for the plain JavaScript generator next door. Same
// arrangement as resultGuard and bundleGuard: the generator stays
// .mjs because it reads the disk, and its callers are type checked,
// because an untyped import makes every result `any`, which is how a
// guard silently stops guarding.

export const BEGIN_MARKER: string;
export const END_MARKER: string;

/** The DROZY summary facts, parsed from docs/drozy-result.txt. */
export type DrozySummary = {
  measured: number;
  analysed: number;
  cite: string;
};

/** Parse the DROZY summary. Throws on a file it cannot read. */
export function parseDrozyResult(text: string): DrozySummary;

/** The UTA-RLDD summary facts, parsed from docs/uta-rldd-result.txt. */
export type UtaSummary = {
  subjects: number;
  analysed: number;
  threeClass: string;
  threeFloor: string;
  binary: string;
  binaryFloor: string;
  p: string;
  cite: string;
};

/** Parse the UTA-RLDD summary. Throws on a file it cannot read. */
export function parseUtaResult(text: string): UtaSummary;

/** The round's three criteria verdicts. */
export type RoundVerdicts = {
  detector: string;
  baseline: string;
  gate: string;
};

/** Parse the criteria verdicts from docs/validation-round.txt. */
export function parseRoundVerdicts(text: string): RoundVerdicts;

/** The whole generated block, markers included. */
export function buildResultsBlock(root: string): string;

/** README text with its marked block replaced. Throws without markers. */
export function spliceResultsBlock(readmeText: string, block: string): string;

/** The committed block as it stands in the README. */
export function committedResultsBlock(readmeText: string): string;

/** The second machine's numbers, and the spread between the pair. */
export type SecondMachine = {
  recallPercent: string;
  found: number;
  annotated: number;
  precisionPercent: string;
  invented: number;
  f1Percent: string;
  recallSpread: string;
  precisionSpread: string;
};

export function parseSecondMachine(text: string): SecondMachine;
