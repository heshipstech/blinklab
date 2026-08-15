import { execFileSync } from "node:child_process";

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
