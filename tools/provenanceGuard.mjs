import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Roadmap 14.3. The provenance table in src/core/metricProvenance.ts
// is what the explain-this-number popovers speak, and two of its
// promises cannot be checked from inside the test tsconfig, which has
// no node types and cannot touch the disk. This is the disk half,
// same arrangement as uiGuard and resultGuard: plain .mjs that reads
// files, hand-written types next door, a type-checked test deciding
// what the readings mean.
//
// The two promises. First, every metric the page renders has an entry
// — read from the SOURCE files rather than the built modules, so the
// check is about what is committed. Second, every document a status
// cites exists in the repository, because a status that leans on
// docs/some-result.txt is only worth reading while that file is real.
//
// One trap this reader is built around: prettier wraps long string
// literals, and a citation split across two literals ("docs/samp" +
// "ling-bounds.txt") would simply VANISH from a source-text match —
// fewer citations found, nothing red. So the table's runtime citation
// count is compared against this reader's source count by the test
// next door, and a split path shows up as the two disagreeing.

/**
 * The slice of source holding the METRIC_PROVENANCE literal, from its
 * declaration to the closing `};` at column zero. Anchored so a
 * helper function above or below the table cannot leak keys into the
 * reading.
 */
export function provenanceTableSlice(source) {
  const start = source.indexOf("export const METRIC_PROVENANCE");
  if (start === -1) {
    return null;
  }
  const end = source.indexOf("\n};", start);
  if (end === -1) {
    return null;
  }
  return source.slice(start, end + 3);
}

/**
 * The metric labels the table declares, in source order.
 *
 * Two spellings, because prettier writes an identifier-safe key bare:
 * quoted keys like `"Alertness score": {` and bare ones like
 * `Blinks: {`, both at the table's own two-space depth so the nested
 * `kind:`/`status:` fields three or four spaces deep stay out.
 */
export function provenanceKeys(source) {
  const slice = provenanceTableSlice(source);
  if (slice === null) {
    return [];
  }
  return [
    ...slice.matchAll(/^ {2}(?:"([^"]+)"|([A-Za-z][A-Za-z0-9_$]*)): \{$/gm),
  ].map((match) => match[1] ?? match[2]);
}

/**
 * Every document the table cites, in source order, duplicates kept.
 *
 * Duplicates are data: the test compares this count against the
 * runtime count from core/docCitations.ts, and a de-duplicated list
 * would let one split citation hide behind another whole one.
 */
export function provenanceCitations(source) {
  const slice = provenanceTableSlice(source);
  if (slice === null) {
    return [];
  }
  return [...slice.matchAll(/docs\/[A-Za-z0-9._/-]+\.(?:txt|md)/g)].map(
    (match) => match[0],
  );
}

/** The idle readout labels out of src/core/idleStrings.ts. */
export function idleLabels(idleSource) {
  return [...idleSource.matchAll(/^\s*\["([^"]+)", "[^"]*"\],?$/gm)].map(
    (match) => match[1],
  );
}

/** Which of `paths` name no file under the repository root. */
export function missingFiles(paths, root) {
  return paths.filter((path) => !existsSync(join(root, path)));
}

/** A repository file as text, resolved against the given root. */
export function readSource(relativePath, root) {
  return readFileSync(join(root, relativePath), "utf8");
}
