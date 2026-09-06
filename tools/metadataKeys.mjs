import { readFileSync } from "node:fs";
import { join } from "node:path";

// The metadata contract, read from the TypeScript side.
//
// Roadmap 10.1f1, ladder D6 and B16. `analysis/tests/test_metadata_
// contract.py` reads the same keys out of the same writers and holds
// them to its own hand-written list. This is the other side of that
// border: it reads the writers and holds them to SPEC.md's table.
//
// Both sides are needed, and the reason is measured rather than
// assumed. Renaming `sampled_fps` in `sessionMetadata.ts` reddened
// three Python tests and left the whole TypeScript suite green, which
// means the browser could rename a key its own suite never mentions and
// only the analysis track would notice — on a machine nobody may run
// that day.
//
// It lives here rather than in the test for the reason guardsArmed's
// reader does: the test tsconfig has no node types.

/** Every module that writes a `# key: value` row, plus the assembler. */
export const METADATA_WRITERS = [
  "sessionMetadata",
  "blinkLog",
  "csv",
  "frameClock",
  "frameTrace",
  "kss",
  "stepCalibration",
];

/**
 * Comments removed.
 *
 * `# key: value` is how these modules describe their own format, so a
 * reader that skipped this would report a metadata key called `key`.
 */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Every metadata key one source writes.
 *
 * Three shapes, because the writers use three: a `line("x", …)` call
 * whether or not it wraps across lines, a `line(\`marker_${i}_…\`, …)`
 * family normalised to its family name, and a bare template row.
 */
export function keysIn(source) {
  const clean = stripComments(source);
  const found = new Set();
  for (const match of clean.matchAll(/line\(\s*"([a-z_0-9]+)"/g)) {
    found.add(match[1]);
  }
  for (const match of clean.matchAll(/line\(\s*`([^`]+)`/g)) {
    found.add(match[1].replace(/\$\{[^}]*\}/g, "N"));
  }
  for (const match of clean.matchAll(/`# ([a-z_0-9]+):/g)) {
    found.add(match[1]);
  }
  return found;
}

/** Every metadata key the browser can write, sorted. */
export function declaredMetadataKeys(root) {
  const keys = new Set();
  for (const writer of METADATA_WRITERS) {
    const source = readFileSync(join(root, "src/core", `${writer}.ts`), "utf8");
    for (const key of keysIn(source)) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

/** The keys SPEC.md's session-metadata table names, sorted. */
export function specMetadataKeys(root) {
  const text = readFileSync(join(root, "SPEC.md"), "utf8");
  const start = text.indexOf("### The session metadata block");
  if (start === -1) {
    throw new Error("SPEC.md has no session metadata block section");
  }
  const after = text.indexOf("\n## ", start);
  const section = text.slice(start, after === -1 ? undefined : after);
  // The formatter pads the cells, so the padding is matched rather than
  // assumed away: a pattern that assumed the cells were flush found one
  // key of 57 and the comparison it fed still ran.
  return [...section.matchAll(/^\| *`([a-z_0-9N]+)` *\|/gm)]
    .map((match) => match[1])
    .sort();
}
