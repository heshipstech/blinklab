import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// The DROZY correlations were measured on 9 August 2026 and three days
// later PR #225 changed how the blink shape window is measured. Blink
// intervals re-measure identically, so blink duration, long closures,
// blink rate and PERCLOS are untouched; the three columns blinkShape.ts
// produces are not, and those three are exactly the rows the verdict
// calls suggestive and unconfirmed.
//
// A sentence saying so is only worth as much as the thing that keeps it
// there. This guard does not check that the prose exists. It reads the
// measuring commit OUT of the published result file, asks git whether
// src/core/blinkShape.ts has moved since that commit, and requires the
// caveat only while the answer is yes.
//
// That makes it self-retiring. Re-measure DROZY on current code, update
// the "built from" line to the new commit, and the requirement lifts on
// its own. Nobody has to remember to delete a stale warning, which is
// how the Stage E boxes in REMEDIATION.md went stale in the first
// place.
//
// Same arrangement as bundleGuard, exportGuard, claimGuard and
// resultGuard: plain .mjs because it reads the disk and shells out to
// git, hand-written types next door, callers type checked.

/** Where docs/drozy-result.txt records the commit its numbers came from. */
const MEASURING_COMMIT = /built from\s+([0-9a-f]{7,40})\b/;

/** The file whose output the caveat is about. */
export const SHAPE_SOURCE = "src/core/blinkShape.ts";

/**
 * The published feature label for each field of BlinkShape.
 *
 * The mapping is here rather than inferred because the two vocabularies
 * are genuinely different: the code says `peakClosingVelocityMmPerS`
 * and the result file says "closing velocity". A test holds this map to
 * the real type, so adding a fourth shape column fails the build until
 * somebody decides what DROZY's caveat should say about it.
 */
export const SHAPE_FEATURE_LABELS = {
  amplitudeMm: "blink amplitude",
  peakClosingVelocityMmPerS: "closing velocity",
  amplitudeOverVelocityMs: "amplitude over velocity",
};

/**
 * Every published DROZY feature and the sources that produce it,
 * roadmap 10.3.
 *
 * The guard above watched ONE source, blinkShape.ts, because in
 * August that was the one file that had moved since the measuring
 * commit. By September every feature's sources had moved — the
 * personal blink line rewrote blink.ts, the shut-line work touched
 * perclos.ts and longClosure.ts — and the caveat still spoke only of
 * three rows. This map makes the caveat's scope computable: a
 * feature is stale exactly when git says one of ITS sources moved,
 * and the test next door holds the keys to the published table in
 * both directions so a new row cannot ship unmapped.
 *
 * blink.ts rides under every event-derived feature on purpose: the
 * detector decides which blinks exist at all, so moving it moves the
 * population every downstream column is computed over.
 */
export const FEATURE_SOURCES = {
  "blink duration": ["src/core/blink.ts"],
  "closing velocity": ["src/core/blinkShape.ts", "src/core/blink.ts"],
  "amplitude over velocity": ["src/core/blinkShape.ts", "src/core/blink.ts"],
  "blink amplitude": ["src/core/blinkShape.ts", "src/core/blink.ts"],
  "long closures": ["src/core/longClosure.ts"],
  "blink rate": ["src/core/blinkRate.ts", "src/core/blink.ts"],
  PERCLOS: ["src/core/perclos.ts"],
};

/**
 * The feature names out of the result file's PRIMARY table, in row
 * order: the text before the first comma of each two-space-indented
 * row. The header row carries no comma and excludes itself. Throws
 * when the table is gone, because a result file that stopped
 * publishing its rows is the defect, not a case to skip.
 */
export function publishedFeatures(resultText) {
  const start = resultText.indexOf("PRIMARY,");
  if (start === -1) {
    throw new Error(
      "drozy result file: could not find the PRIMARY feature table",
    );
  }
  const rest = resultText.slice(start);
  const block = rest.slice(0, rest.indexOf("\n\n"));
  return [...block.matchAll(/^ {2}([A-Za-z][A-Za-z ]*?),/gm)].map(
    (match) => match[1],
  );
}

/**
 * The mapped sources that name no file in this repository, as
 * "feature -> source" strings. Here rather than in the test because
 * the test tsconfig has no node types and cannot touch the disk —
 * the same split as every other guard.
 */
export function missingSources(root) {
  return Object.entries(FEATURE_SOURCES).flatMap(([feature, sources]) =>
    sources
      .filter((source) => !existsSync(join(root, source)))
      .map((source) => `${feature} -> ${source}`),
  );
}

/**
 * The features whose sources git says moved since `sinceSha`: the
 * rows the caveat must name, computed rather than remembered.
 */
export function movedFeatures(sinceSha, root) {
  return Object.entries(FEATURE_SOURCES)
    .filter(([, sources]) =>
      sources.some(
        (source) => commitsTouchingSince(source, sinceSha, root).length > 0,
      ),
    )
    .map(([feature]) => feature);
}

/**
 * Where each document's caveat begins.
 *
 * The checks below run against the caveat BLOCK, not the whole file.
 * README.md names "closing velocity" up in its feature list, so a
 * whole-document search would pass with the caveat deleted, which is
 * the same shape of hole as a test that cannot fail.
 */
export const CAVEAT_MARKERS = {
  "docs/drozy-result.txt": "MEASURING COMMIT",
  "README.md": "measured by code that has since changed",
};

/**
 * The caveat block: the marker and everything up to the blank line that
 * ends it. Null when the marker is gone, which is a failure, not a skip.
 */
export function caveatBlock(doc, marker) {
  const start = doc.indexOf(marker);
  if (start === -1) {
    return null;
  }
  const rest = doc.slice(start);
  const end = rest.indexOf("\n\n");
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The commit docs/drozy-result.txt says its numbers were built from.
 *
 * Throws rather than returning null: a result file that no longer says
 * which code produced it is the defect this guard exists to prevent,
 * not a case to skip past. Same rule as parseResultFile.
 */
export function parseMeasuringCommit(text) {
  const match = text.match(MEASURING_COMMIT);
  if (match === null) {
    throw new Error(
      'drozy result file: could not find the "built from <commit>" line',
    );
  }
  return match[1];
}

/**
 * The field names of the BlinkShape type, read from the source.
 *
 * Read rather than remembered, the same way the CSV contract test reads
 * CSV_COLUMNS out of csv.ts: a list of columns kept by hand in a guard
 * is a list that drifts from the code it claims to guard.
 */
export function shapeFieldNames(source) {
  const block = source.match(/export type BlinkShape = \{([^}]*)\}/);
  if (block === null) {
    throw new Error("blinkShape.ts: could not find the BlinkShape type");
  }
  return [...(block[1] ?? "").matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
}

/** Whether a commit is present in this checkout at all. */
export function commitExists(sha, root) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/** Whether `sha` is an ancestor of HEAD, so the history really contains it. */
export function isAncestorOfHead(sha, root) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Short hashes of the commits touching `relativePath` since `sinceSha`,
 * newest first. Empty means the file has not moved since that commit.
 */
export function commitsTouchingSince(relativePath, sinceSha, root) {
  const out = execFileSync(
    "git",
    ["log", "--format=%h", `${sinceSha}..HEAD`, "--", relativePath],
    { cwd: root, encoding: "utf8" },
  );
  return out.split("\n").filter((line) => line.length > 0);
}
