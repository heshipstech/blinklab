// Types for the plain JavaScript guard next door. Same arrangement as
// uiGuard and resultGuard: the guard stays .mjs because it reads the
// disk, and its callers are type checked, because an untyped import
// makes every result `any`, which is how a guard silently stops
// guarding.

/** The METRIC_PROVENANCE literal's slice of source, or null if absent. */
export function provenanceTableSlice(source: string): string | null;

/** The metric labels the table declares, in source order. */
export function provenanceKeys(source: string): string[];

/** Every document the table cites, in source order, duplicates kept. */
export function provenanceCitations(source: string): string[];

/** The idle readout labels out of src/core/idleStrings.ts. */
export function idleLabels(idleSource: string): string[];

/** Which of `paths` name no file under the repository root. */
export function missingFiles(paths: readonly string[], root: string): string[];

/** A repository file as text, resolved against the given root. */
export function readSource(relativePath: string, root: string): string;
