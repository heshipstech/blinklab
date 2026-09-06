import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Six places in this repository claimed the page sent nothing anywhere.
// All six were false, and one of them was printed on the page itself.
// The August 2026 audit measured a POST from the vendored MediaPipe
// bundle to Google, sixty seconds after the face model is created,
// needing no detections. ADR-0004 has the whole record.
//
// Correcting six files is easy. Keeping them corrected is the hard part,
// because the retired sentences are pleasant to write and someone
// tidying the README in six months will reach for one without knowing
// it was ever measured and found wrong.
//
// So the phrases are banned by a test rather than by a memory. This
// guard asks git which tracked files contain them, and the test fails on
// any hit. Writing about the history is still possible: describe what
// the page used to deny, do not quote the sentence back, or the guard
// cannot tell a confession from a relapse.

/**
 * Claims this repository is no longer allowed to make, and why each is
 * false.
 *
 * Patterns rather than fixed strings, since roadmap 10.1c and ladder
 * D16. The guard searched for exact wordings, so "no data leaves your
 * device" was banned while PROJECT.md carried "No data leaves the
 * device, at any time, for any reason": the same claim one word away,
 * and stronger than the one that had been measured false. A claim is a
 * family of sentences, not a spelling, so each entry now carries the
 * family. `says` is the wording a message can quote back.
 */
export const RETIRED_CLAIMS = [
  {
    pattern: "no +data +(ever +)?leaves +(your|the|this) +device",
    says: "no data leaves your device",
    because: "the vendored model posts usage statistics to Google",
  },
  {
    pattern: "no +telemetry",
    says: "no telemetry",
    because: "MediaPipe reports its own usage; ours is the only absent kind",
  },
  {
    pattern: "zero +runtime +third +party +calls",
    says: "zero runtime third party calls",
    because: "ADR-0002 claimed this as a benefit and it was never measured",
  },
];

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot() {
  // Not `new URL(...).pathname`. This project lives in a folder with a
  // space in its name, so pathname returns "blinklab%20build" and every
  // path built from it fails. Third time this trap has been hit here.
  return fileURLToPath(new URL("../", import.meta.url));
}

/**
 * Every file matching the pattern, tracked or newly added, case
 * insensitive.
 *
 * Uses `git grep` so the set searched is the set that ships, with no
 * hand-maintained ignore list to drift out of date, and `--untracked` so
 * a brand new file is searched too. Without that flag this guard passed
 * locally and failed in continuous integration the first time it was
 * used, because the new ADR describing the problem was not yet added and
 * git grep could not see it. A guard that only notices a claim after it
 * is committed is a guard that reports the fire from inside the
 * building.
 */
export function trackedFilesMatching(pattern, root) {
  try {
    const out = execFileSync(
      "git",
      ["grep", "--files-with-matches", "--untracked", "-i", "-E", pattern],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    return out.split("\n").filter((line) => line.length > 0);
  } catch {
    // git grep exits 1 when nothing matches, which is the good case.
    return [];
  }
}

/** Every retired claim that has come back, with the files it came back in. */
export function relapses(root, exempt = []) {
  const found = [];
  for (const claim of RETIRED_CLAIMS) {
    const files = trackedFilesMatching(claim.pattern, root).filter(
      (file) => !exempt.includes(file),
    );
    if (files.length > 0) {
      found.push({ phrase: claim.says, because: claim.because, files });
    }
  }
  return found;
}
