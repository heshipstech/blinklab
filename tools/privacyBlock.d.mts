// Types for the plain JavaScript generator next door. Same arrangement
// as resultsBlock and cannotSeeBlock: the generator stays .mjs because
// it reads the disk, and its callers are type checked.

/** One thing the page keeps on the visitor's own device. */
export type StoredItemSource = {
  key: string;
  what: string;
  why: string;
};

/** The stored items parsed out of src/core/storedData.ts. Throws when it finds none. */
export function storedItems(storedDataSource: string): StoredItemSource[];

/** The export disclosure sentence parsed out of src/core/exportContents.ts. */
export function exportSentence(exportContentsSource: string): string;

/** The generated block, markers included. */
export function buildPrivacyBlock(root: string): string;

/** README with its privacy block replaced. Throws when the markers are wrong. */
export function splicePrivacyBlock(readmeText: string, block: string): string;

/** The committed block as it stands in the README, markers included. */
export function committedPrivacyBlock(readmeText: string): string;

/** README's whole Privacy section, generated part and prose alike. */
export function privacySection(readmeText: string): string;
