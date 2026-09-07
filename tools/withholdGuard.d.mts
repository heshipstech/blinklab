// Types for the plain JavaScript reader next door. Same arrangement as
// the other guards: it stays .mjs because it reads the disk, and its
// caller is type checked.

/** The record fields a refused session must withhold. */
export const WITHHELD_FIELDS: readonly string[];

/** The `assembleFeatureRecord({ ... })` call in main.ts, as text. */
export function recordAssembly(root: string): string;

/** Which of WITHHELD_FIELDS the assembly does not guard on `withheld`. */
export function fieldsNotWithheld(root: string): string[];
