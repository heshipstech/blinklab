import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./resultGuard.mjs";
import { buildStatusBlock, spliceStatusBlock } from "./statusBlock.mjs";

// Regenerate STATE.md's status block in place. The block's own test
// compares the committed copy against buildStatusBlock, so forgetting
// to run this after a phase closes or a headline moves is a red
// build, not a stale summary.

const root = repoRoot();
const statePath = join(root, "STATE.md");
const state = readFileSync(statePath, "utf8");
const spliced = spliceStatusBlock(state, buildStatusBlock(root));
if (spliced === state) {
  process.stdout.write("status block: already current\n");
} else {
  writeFileSync(statePath, spliced);
  process.stdout.write("status block: rewritten from the record\n");
}
