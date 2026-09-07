// Roadmap 10.0b1. Asks vitest how many tests it collects and holds
// test/collected-tests.txt to the answer.
//
// This cannot be a unit test. Counting cases means loading every test
// file, and a test that did so would be counting the run it is part
// of, from inside it. So it is a build step: `npm run counts:check`,
// run in continuous integration beside the suite, which is where the
// row's own Check puts it — a hand-edited count reddens the BUILD.
//
// The sibling contract on the Python side is a pytest test, because
// there the runner and the guard already sit in the same job.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import {
  countListedTests,
  parseCollectedCount,
  repoRoot,
} from "./resultGuard.mjs";

const root = repoRoot();
const FILE = "test/collected-tests.txt";

const committed = parseCollectedCount(
  readFileSync(new URL(`../${FILE}`, import.meta.url), "utf8"),
  FILE,
);

// --run so the listing is printed and the process exits rather than
// watching. stdio is captured; a non-zero exit throws by itself.
const listing = execFileSync(
  process.execPath,
  [
    new URL("../node_modules/vitest/vitest.mjs", import.meta.url).pathname,
    "list",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const collected = countListedTests(listing);

if (collected !== committed) {
  console.error(
    `${FILE} states ${String(committed)} tests; vitest collects ${String(collected)}.\n` +
      "Update the file (and every document that publishes the figure) to the runner's number.",
  );
  process.exit(1);
}

console.log(`Collected tests: ok — ${String(collected)} matches ${FILE}.`);
