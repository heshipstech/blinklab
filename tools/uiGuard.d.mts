// Types for the plain JavaScript guard next door. Same arrangement as
// the other guards: the guard stays .mjs because it reads the disk,
// and its callers are type checked, because an untyped import makes
// every result `any`, which is how a guard silently stops guarding.

/** Every heading passed to box() in main.ts, in source order. */
export function boxHeadings(mainSource: string): string[];

/** Every box name documented by a heading in docs/UI.md. */
export function documentedBoxes(uiDoc: string): string[];

/** Box headings in the code with no section in the document. */
export function undocumented(mainSource: string, uiDoc: string): string[];

/** Boxes the document describes that the code no longer builds. */
export function fossils(mainSource: string, uiDoc: string): string[];

/** Every string literal assigned as a button's label in main.ts, once each. */
export function buttonStrings(mainSource: string): string[];

/** The idle table out of src/core/idleStrings.ts, each entry as `Label: value`. */
export function idleStrings(idleSource: string): string[];

/** The strings among `strings` that `doc` never mentions verbatim. */
export function undocumentedStrings(
  strings: readonly string[],
  doc: string,
): string[];
