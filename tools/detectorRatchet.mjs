import { execFileSync } from "node:child_process";

// Roadmap 10.1a, the detector-change measurement ratchet.
//
// The published Eyeblink8 numbers are a property of the commit that
// measured them. Twice this project has let the prose and the code
// drift apart — correct numbers, rotten sentences — and each time the
// fix was to update the prose, which is exactly the fix that rots
// again. So the binding is now mechanical: docs/eyeblink8-result.txt
// carries a "Built from commit <sha>" line naming the last commit
// whose corpus run reproduced the published numbers, and this guard
// asks git whether any detector source has been touched since.
//
// Touched and re-measured: move the built-from line. Touched and NOT
// re-measured: the file must say so, in a dated caveat that names
// every touching commit. And once a re-measure moves the line, a
// lingering "not yet re-measured" caveat is itself a false sentence
// and goes red from the other side. The ratchet retires its own
// caveats; nothing here depends on anyone remembering.
//
// Same arrangement as resultGuard, claimGuard and learningGuard:
// plain .mjs reading the disk and git, verdicts as data, callers type
// checked, the test file is what CI runs.

/**
 * The modules whose change can move the published corpus numbers: the
 * detector itself, everything it imports, and the measurement chain
 * that feeds it (landmarks in, aperture, validity, baseline, the
 * calibration line the detector reads, and the clip-stepping frame
 * bookkeeping). Deliberately INCLUSIVE: a false staleness costs one
 * honest caveat line, a false freshness costs silent rot, and those
 * prices are not close. The list is checked against the disk by a
 * test, so a rename cannot silently drop a file out of the watch.
 */
export const DETECTOR_SOURCES = [
  "src/core/blink.ts",
  "src/core/blinkShape.ts",
  "src/core/aperture.ts",
  "src/core/baseline.ts",
  "src/core/guidedCalibration.ts",
  "src/core/calibrationWindow.ts",
  "src/core/ear.ts",
  "src/core/geometry.ts",
  "src/core/statistics.ts",
  "src/core/constants.ts",
  "src/core/headPose.ts",
  "src/core/validityGate.ts",
  "src/core/landmarkGuard.ts",
  "src/core/landmarks.ts",
  "src/core/frameSearch.ts",
  "src/core/frameClock.ts",
];

/** The exact caveat phrase the guard keys on. Editing "not yet
 * re-measured" into "re-measured on <date>" after a corpus run is how
 * a caveat retires into history without being deleted. */
export const STALE_MARKER = "DETECTOR CHANGED, not yet re-measured";

const BUILT_FROM = /Built from commit ([0-9a-f]{40})\b/;

/** The ratchet's anchor: the full sha the result file names, or null. */
export function builtFromSha(resultText) {
  const match = resultText.match(BUILT_FROM);
  return match === null ? null : match[1];
}

/**
 * Every commit after the anchor that touched a detector source, as
 * {sha, subject}. Empty means the published numbers still describe
 * the code.
 */
export function commitsTouchingSince(sha, root) {
  const out = execFileSync(
    "git",
    ["log", "--format=%H%x00%s", `${sha}..HEAD`, "--", ...DETECTOR_SOURCES],
    { cwd: root, encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [commitSha, subject] = line.split("\0");
      return { sha: commitSha, subject: subject ?? "" };
    });
}

/**
 * The verdict, as data rather than an exit code, so the truth table is
 * testable without git. `touching` is commitsTouchingSince's output.
 */
export function ratchetVerdict(resultText, touching) {
  const sha = builtFromSha(resultText);
  if (sha === null) {
    return {
      ok: false,
      why:
        "docs/eyeblink8-result.txt carries no 'Built from commit <full sha>' " +
        "line, so the ratchet has no anchor to hold the numbers to.",
    };
  }
  const markerPresent = resultText.includes(STALE_MARKER);
  if (touching.length === 0) {
    if (markerPresent) {
      return {
        ok: false,
        why:
          `the result file still says "${STALE_MARKER}" although no ` +
          "detector source changed since the built-from commit: a caveat " +
          "standing on a fresh measurement is a false sentence. Retire it " +
          '(edit it to "re-measured on <date>") or move the anchor back.',
      };
    }
    return { ok: true, why: "no detector source changed since the anchor" };
  }
  const describe = touching
    .map((commit) => `${commit.sha.slice(0, 7)} ${commit.subject}`)
    .join("; ");
  if (!markerPresent) {
    return {
      ok: false,
      why:
        "detector sources changed after the built-from commit " +
        `(${describe}) and the result file does not say so. Either ` +
        "re-measure the corpus and move the built-from line, or add a " +
        `dated "${STALE_MARKER}" caveat naming every commit.`,
    };
  }
  const missing = touching.filter(
    (commit) => !resultText.includes(commit.sha.slice(0, 7)),
  );
  if (missing.length > 0) {
    const named = missing
      .map((commit) => `${commit.sha.slice(0, 7)} ${commit.subject}`)
      .join("; ");
    return {
      ok: false,
      why: `the caveat is present but does not name: ${named}`,
    };
  }
  return { ok: true, why: "stale, and honestly declared" };
}
