import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./resultGuard.mjs";
import { buildResultsBlock, spliceResultsBlock } from "./resultsBlock.mjs";

// Regenerate the README's results block in place. The block's own
// test compares the committed README against buildResultsBlock, so
// forgetting to run this after a result file changes is a red build,
// not a stale page.

const root = repoRoot();
const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const spliced = spliceResultsBlock(readme, buildResultsBlock(root));
if (spliced === readme) {
  process.stdout.write("results block: already current\n");
} else {
  writeFileSync(readmePath, spliced);
  process.stdout.write("results block: rewritten from the result files\n");
}
