// Types for the plain JavaScript reader next door. Same arrangement as
// the other guards: it stays .mjs because it reads the disk, and its
// caller is type checked.

/** Every module that writes a `# key: value` row, plus the assembler. */
export const METADATA_WRITERS: readonly string[];

/** Comments removed, so prose describing the format is not read as data. */
export function stripComments(source: string): string;

/** Every metadata key one source writes. */
export function keysIn(source: string): Set<string>;

/** Every metadata key the browser can write, sorted. */
export function declaredMetadataKeys(root: string): string[];

/** The keys SPEC.md's session-metadata table names, sorted. Throws when absent. */
export function specMetadataKeys(root: string): string[];

/** SPEC.md's "when written" cell for each key in the metadata table. */
export function specPresenceRules(root: string): Record<string, string>;

/** The row builders `exportSession` spreads into the session CSV, in order. */
export function exportRowBuilders(root: string): string[];
