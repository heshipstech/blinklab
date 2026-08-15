// The command line half of learningGuard, kept in its own file so the
// guard itself has no side effects at import and can be unit tested.
// Continuous integration runs this on pull requests only:
//
//     node tools/checkLearningEntry.mjs <base-sha>
//
// Exits 1 with an explanation when a pull request changes src/ without
// either writing to LEARNING.md or saying in a commit message why not.

import { repoRoot } from "./resultGuard.mjs";
import {
  changedFilesSince,
  commitMessagesSince,
  verdict,
} from "./learningGuard.mjs";

const baseSha = process.argv[2];
if (baseSha === undefined || baseSha.length === 0) {
  console.error("usage: node tools/checkLearningEntry.mjs <base-sha>");
  process.exit(2);
}

const root = repoRoot();
const files = changedFilesSince(baseSha, root);
const messages = commitMessagesSince(baseSha, root);
const result = verdict(files, messages);

// Print the verdict either way. A guard that is silent when it passes
// gives a reader no way to tell "checked and fine" from "never ran",
// and this repository has been bitten by that distinction more than
// once.
console.log(
  `Definition of Done: ${result.ok ? "ok" : "FAILED"} — ${result.why}`,
);
if (!result.ok) {
  console.error(`Files changed under src/:`);
  for (const file of files.filter((f) => f.startsWith("src/"))) {
    console.error(`  ${file}`);
  }
  process.exit(1);
}
