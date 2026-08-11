import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The August 2026 audit found the numbers right and the prose rotten:
// STATE.md's own reproduction command printed the retired 82.8% against
// a README headline of 87.7%, the withdrawn-glasses paragraph printed
// the superseded run's split while calling it corrected, and three
// documents carried two different test counts, neither of them true.
//
// Every one of those sentences was written correctly and then the run
// changed underneath it. So the fix is not "update the prose", which is
// what the project did twice before. The fix is a guard that reads the
// COMMITTED RESULT FILE, docs/eyeblink8-result.txt, and fails the build
// when a summary document stops agreeing with it. The result file is
// already the single source of truth; this makes disagreeing with it a
// red build instead of a finding in the next audit.
//
// Same arrangement as bundleGuard, exportGuard and claimGuard: plain
// .mjs that reads the disk, hand-written types next door, callers type
// checked.

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot() {
  // Not `new URL(...).pathname`: this project lives in a folder with a
  // space in its name, so pathname percent-encodes it and every read
  // fails. That trap is now three for three in this repository.
  return fileURLToPath(new URL("../", import.meta.url));
}

/** Read a file as text, relative to the repository root. */
export function readRepoFile(relativePath, root) {
  return readFileSync(join(root, relativePath), "utf8");
}

/**
 * The current run's numbers, parsed out of docs/eyeblink8-result.txt.
 *
 * The file keeps superseded runs below the current one on purpose, so
 * every pattern here takes the FIRST match, which is the current run.
 * Throws rather than returning a partial object: a result file this
 * cannot parse is itself a finding, not something to skip past.
 */
export function parseResultFile(text) {
  const grab = (pattern, what) => {
    const match = text.match(pattern);
    if (match === null) {
      throw new Error(`result file: could not find ${what}`);
    }
    return match;
  };

  const recall = grab(
    /Recall\s+([\d.]+)%\s+\((\d+) of (\d+) found\)/,
    "the recall line",
  );
  const precision = grab(
    /Precision\s+([\d.]+)%\s+\((\d+) invented\)/,
    "the precision line",
  );
  const f1 = grab(/F1\s+([\d.]+)%/, "the F1 line");
  const withGlasses = grab(
    /with glasses\s+1 clip\(s\), recall ([\d.]+)%, precision ([\d.]+)%/,
    "the with-glasses split",
  );
  const withoutGlasses = grab(
    /without\s+7 clip\(s\), recall ([\d.]+)%, precision ([\d.]+)%/,
    "the without-glasses split",
  );
  const reproDir = grab(
    /"\$DATASETS\/(eyeblink8-measured-[a-z0-9-]+)"/,
    "the reproduction directory",
  );
  const misses = grab(
    /(\d+) misses, of which (\d+) carry at least one frame\s+the human marked fully closed, ([\d.]+)%/,
    "the rebuilt miss figures",
  );

  return {
    recallPercent: recall[1],
    found: Number(recall[2]),
    annotated: Number(recall[3]),
    precisionPercent: precision[1],
    invented: Number(precision[2]),
    f1Percent: f1[1],
    glasses: { recall: withGlasses[1], precision: withGlasses[2] },
    noGlasses: { recall: withoutGlasses[1], precision: withoutGlasses[2] },
    reproDir: reproDir[1],
    missTotal: Number(misses[1]),
    missFullyClosed: Number(misses[2]),
    missPercent: misses[3],
  };
}

/**
 * The number a document states immediately before the words "unit
 * tests", or null if it makes no such claim. Every summary document
 * that publishes a test count is held to the real one.
 */
export function statedUnitTestCount(docText) {
  const match = docText.match(/(\d+) unit tests/);
  return match === null ? null : Number(match[1]);
}

/** The number a document states before "Python tests", or null. */
export function statedPythonTestCount(docText) {
  const match = docText.match(/(\d+) Python tests/);
  return match === null ? null : Number(match[1]);
}

/** Count `it(` and `test(` calls across test/**\/*.test.ts, recursively. */
export function actualUnitTestCount(root) {
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), {
      withFileTypes: true,
    })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".test.ts")) {
        const source = readFileSync(join(root, path), "utf8");
        count += (source.match(/\b(?:it|test)\(/g) ?? []).length;
      }
    }
  };
  walk("test");
  return count;
}

/** Count `def test_` functions across analysis/tests. */
export function actualPythonTestCount(root) {
  let count = 0;
  for (const entry of readdirSync(join(root, "analysis/tests"))) {
    if (entry.endsWith(".py")) {
      const source = readFileSync(join(root, "analysis/tests", entry), "utf8");
      count += (source.match(/\bdef test_/g) ?? []).length;
    }
  }
  return count;
}
