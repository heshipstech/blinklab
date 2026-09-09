// Types for the plain JavaScript changelog guard next door. Same
// arrangement as the other guards: the tool stays .mjs because it
// reads the disk, and its callers are type checked.

/** The Unreleased section's text, up to the first released version. */
export function unreleasedSection(changelogText: string): string;

/** The Eyeblink8 headline a section states, or null when it states none. */
export function statedEyeblink8(sectionText: string): {
  recall: string;
  precision: string;
  f1: string;
} | null;

/** The number of rule-carrying modules the section claims. */
export function statedGuardCount(sectionText: string): number;
