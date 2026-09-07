import { writeFileSync } from "node:fs";
import { join } from "node:path";

// The regeneration half of the verdict fixture pin, roadmap 10.1f5.
//
// It lives here for the reason every reader in this folder does: the
// test tsconfig carries no node types, so a `writeFileSync` in a
// `.test.ts` is an untyped call the type checker refuses.
//
// It is a command rather than a guard, like `writeResultsBlock.mjs`
// next door, and it writes nothing unless asked. The asking is an
// environment variable rather than an argument because the caller is
// vitest, which owns its own command line: `npm run fixtures:write`
// sets it and runs the one spec.

/** Whether this run was asked to rewrite the fixtures. */
export function updateRequested() {
  return process.env["UPDATE_FIXTURES"] === "1";
}

/** Write one fixture, replacing what is there. */
export function writeFixture(relativePath, text, root) {
  writeFileSync(join(root, relativePath), text, "utf8");
}
