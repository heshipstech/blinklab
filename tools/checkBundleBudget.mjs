// The command line half of bundleBudget, kept separate so the module
// itself has no side effects at import and can be unit tested.
//
//     npm run build && node tools/checkBundleBudget.mjs
//
// Roadmap 8.7. Exits 1 when the built JavaScript exceeds the budget,
// and prints the number either way: a check that is silent on success
// gives a reader no way to tell "measured and fine" from "never ran".

import { join } from "node:path";

import { repoRoot } from "./resultGuard.mjs";
import { budgetVerdict, bundleChunks } from "./bundleBudget.mjs";

const assetsDir = join(repoRoot(), "dist", "assets");
let chunks;
try {
  chunks = bundleChunks(assetsDir);
} catch (error) {
  console.error(
    `Bundle budget: could not read ${assetsDir}. Run the build first.`,
  );
  console.error(String(error));
  process.exit(2);
}

const result = budgetVerdict(chunks);
console.log(`Bundle budget: ${result.ok ? "ok" : "FAILED"} — ${result.why}`);
if (!result.ok) {
  for (const chunk of [...chunks].sort((a, b) => b.bytes - a.bytes)) {
    console.error(`  ${(chunk.bytes / 1000).toFixed(1)} kB  ${chunk.name}`);
  }
  process.exit(1);
}
