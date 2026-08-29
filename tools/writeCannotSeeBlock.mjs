import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./resultGuard.mjs";
import { buildCannotSeeModule } from "./cannotSeeBlock.mjs";

// Regenerate the committed cannot-see module in place. Its own test
// compares the committed file against buildCannotSeeModule, so
// forgetting to run this after a source document changes is a red
// build, not a report quietly overstating the instrument.

const root = repoRoot();
const modulePath = join(root, "src/core/cannotSee.ts");
const current = existsSync(modulePath)
  ? readFileSync(modulePath, "utf8")
  : null;
const built = buildCannotSeeModule(root);
if (current === built) {
  process.stdout.write("cannot-see block: already current\n");
} else {
  writeFileSync(modulePath, built);
  process.stdout.write("cannot-see block: rewritten from the sources\n");
}
