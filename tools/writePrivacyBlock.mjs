import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildPrivacyBlock, splicePrivacyBlock } from "./privacyBlock.mjs";
import { repoRoot } from "./resultGuard.mjs";

// Regenerate README's Privacy block in place. Its own test rebuilds
// the block and compares, so forgetting to run this after a stored key
// is added is a red build rather than a README that quietly
// under-counts what the app keeps.

const root = repoRoot();
const readmePath = join(root, "README.md");
const current = readFileSync(readmePath, "utf8");
const next = splicePrivacyBlock(current, buildPrivacyBlock(root));
if (current === next) {
  process.stdout.write("privacy block: already current\n");
} else {
  writeFileSync(readmePath, next);
  process.stdout.write("privacy block: rewritten from the sources\n");
}
