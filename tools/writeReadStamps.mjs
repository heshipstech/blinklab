import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { READ_IN_FULL_DOCS, claimDigest } from "./readGuard.mjs";
import { repoRoot } from "./resultGuard.mjs";

// Recompute the claims digest inside each read-in-full stamp.
//
// Run this ONLY after actually reading the document end to end. The
// stamp records an act, and a script that refreshes it without the act
// having happened turns the whole mechanism into a formality. It exists
// so the digest does not have to be pasted by hand once the read is
// done, not so the read can be skipped.

const root = repoRoot();
for (const name of READ_IN_FULL_DOCS) {
  const path = join(root, name);
  const text = readFileSync(path, "utf8");
  const digest = claimDigest(text);
  const updated = text.replace(
    /(Read in full on [^,\n]+, claims )`[0-9a-f]{8}`/,
    `$1\`${digest}\``,
  );
  if (updated === text) {
    // Either the digest already matches, or there is no stamp at all.
    // Saying which matters: the first is fine and the second is a
    // document that has not been read yet, and the test that demands a
    // stamp is the one that should catch that, not silence here.
    process.stdout.write(
      text.includes("Read in full on")
        ? `${name}: already current\n`
        : `${name}: NO STAMP — this file has never been read in full\n`,
    );
    continue;
  }
  writeFileSync(path, updated);
  process.stdout.write(`${name}: claims ${digest}\n`);
}
