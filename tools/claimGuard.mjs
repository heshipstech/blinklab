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

/** Claims this repository is no longer allowed to make, and why each is false. */
export const RETIRED_CLAIMS = [
  {
    phrase: "no data leaves your device",
    because: "the vendored model posts usage statistics to Google",
  },
  {
    phrase: "no telemetry",
    because: "MediaPipe reports its own usage; ours is the only absent kind",
  },
  {
    phrase: "zero runtime third party calls",
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
 * Every tracked file containing the phrase, case insensitive.
 *
 * Uses `git grep` so the set searched is exactly the set that ships,
 * with no hand-maintained ignore list to drift out of date.
 */
export function trackedFilesContaining(phrase, root) {
  try {
    const out = execFileSync(
      "git",
      ["grep", "--files-with-matches", "-i", "-F", phrase],
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
    const files = trackedFilesContaining(claim.phrase, root).filter(
      (file) => !exempt.includes(file),
    );
    if (files.length > 0) {
      found.push({ phrase: claim.phrase, because: claim.because, files });
    }
  }
  return found;
}
