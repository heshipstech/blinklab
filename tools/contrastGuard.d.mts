// Types for the plain JavaScript guard next door. Same arrangement as
// resultGuard and uiGuard: the guard stays .mjs because it reads the
// disk, and its callers are type checked, because an untyped import
// makes every result `any`, which is how a guard stops guarding.

/** The sRGB relative luminance of a six-digit hex colour. */
export function relativeLuminance(hex: string): number;

/** The WCAG contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(foreground: string, background: string): number;

/** WCAG AA for normal-size text. */
export const AA_NORMAL_TEXT: number;

/** The custom properties declared in src/styles.css, by name. */
export function readTokens(root: string): Record<string, string>;

/** One foreground/background pair the page renders text in. */
export type TextPair = {
  fg: string;
  bg: string;
  where: string;
};

/** Every pair the page renders text in. */
export const TEXT_PAIRS: readonly TextPair[];

/** A pair with its resolved colours, measured ratio and verdict. */
export type CheckedPair = TextPair & {
  /** The hex the token resolved to. Distinct from `fg`, the name. */
  fgColor: string;
  bgColor: string;
  ratio: number;
  passes: boolean;
};

/** Measure every pair against the tokens given. */
export function checkPairs(tokens: Record<string, string>): CheckedPair[];

/** The token name a rule paints its text with. Throws if it sets none. */
export function colorTokenUsedBy(root: string, selector: string): string;
