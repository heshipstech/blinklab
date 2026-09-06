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

/** SPEC.md's session-metadata table, as text. Throws when it is gone. */
function specTableSection(root) {
  const text = readFileSync(join(root, "SPEC.md"), "utf8");
  const start = text.indexOf("### The session metadata block");
  if (start === -1) {
    throw new Error("SPEC.md has no session metadata block section");
  }
  const after = text.indexOf("\n## ", start);
  return text.slice(start, after === -1 ? undefined : after);
}

/** The keys SPEC.md's session-metadata table names, sorted. */
export function specMetadataKeys(root) {
  // The formatter pads the cells, so the padding is matched rather than
  // assumed away: a pattern that assumed the cells were flush found one
  // key of 57 and the comparison it fed still ran.
  return [...specTableSection(root).matchAll(/^\| *`([a-z_0-9N]+)` *\|/gm)]
    .map((match) => match[1])
    .sort();
}

/**
 * SPEC.md's "when written" cell for each key in the metadata table.
 *
 * Roadmap 10.1f3, ladder D6. The column has been prose since 10.1f1
 * wrote it, and prose next to a table is a claim nothing checks. This
 * hands it to a test that exercises the real writers, so a rule stated
 * here and a rule the exporter follows cannot drift apart in silence.
 */
export function specPresenceRules(root) {
  const rules = {};
  for (const match of specTableSection(root).matchAll(
    /^\| *`([a-z_0-9N]+)` *\| *([^|]*?) *\|/gm,
  )) {
    rules[match[1]] = match[2];
  }
  return rules;
}

/**
 * The row builders `exportSession` spreads into the session CSV, in order.
 *
 * A presence test assembles a metadata block from these builders, and
 * a hand-copied list of them would be one more restatement drifting
 * from the page — the exact defect the contract exists to catch. So
 * the list is read from `main.ts` and the test holds its own calls to
 * it.
 */
export function exportRowBuilders(root) {
  const text = readFileSync(join(root, "src/main.ts"), "utf8");
  const start = text.indexOf("function exportSession(");
  if (start === -1) {
    throw new Error("main.ts has no exportSession");
  }
  const open = text.indexOf("serializeRecords(featureRecords, [", start);
  if (open === -1) {
    throw new Error(
      "exportSession does not assemble rows for serializeRecords",
    );
  }
  const close = text.indexOf("\n  ]);", open);
  if (close === -1) {
    throw new Error("the row list in exportSession has no end");
  }
  return [
    ...stripComments(text.slice(open, close)).matchAll(/\.\.\.([A-Za-z]+)\(/g),
  ].map((match) => match[1]);
}
