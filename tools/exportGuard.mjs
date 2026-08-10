import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The privacy stance says an exported CSV is measurements of somebody's
// eyes, this repository is public, and git keeps a file even after a
// later commit deletes it, so exports are refused at the door by
// .gitignore rather than cleaned up afterwards.
//
// That rule was written when there was one export. 6.7 added a second,
// the blink log, and nobody added a second pattern, so until the August
// 2026 audit a user's blink log could have been committed by accident.
//
// This guard exists so a third export cannot repeat it. It reads the
// filenames main.ts actually downloads, and it asks GIT whether each one
// is refused rather than re-implementing git's glob rules, because a
// re-implementation is one more thing that can be wrong in the same
// direction as the bug it is checking for.
//
// It lives in .mjs beside bundleGuard for the same reason that one does:
// it touches the filesystem and shells out, so it cannot live in core,
// and its types are written by hand next door.

/** Every filename `downloadTextFile` can produce, with stamps filled in. */
export function downloadedFilenames(mainSource) {
  const names = [];
  const pattern = /downloadTextFile\(\s*`([^`]+)`/g;
  let match = pattern.exec(mainSource);
  while (match !== null) {
    const template = match[1];
    if (template !== undefined) {
      // Any interpolation becomes a plausible stamp, so what comes out
      // is a filename a real download would actually produce.
      names.push(template.replace(/\$\{[^}]*\}/g, "2026-08-10T10-00-00-000"));
    }
    match = pattern.exec(mainSource);
  }
  return names;
}

/**
 * The repository root as a real filesystem path.
 *
 * Not `new URL(...).pathname`, which percent-encodes: this project lives
 * in a folder called "blinklab build", so pathname hands back
 * "blinklab%20build" and every read fails with ENOENT. That has now cost
 * this project twice, once in the corpus runner and once here.
 */
export function repoRoot() {
  return fileURLToPath(new URL("../", import.meta.url));
}

/** Read a file as text. Separate so the parser above can be tested with no disk. */
export function readText(path) {
  return readFileSync(path, "utf8");
}

/** Ask git, not a glob library, whether this path would be refused. */
export function gitRefusesToTrack(filename, repoRoot) {
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--no-index", filename], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    // check-ignore exits non-zero when the path is NOT ignored.
    return false;
  }
}
