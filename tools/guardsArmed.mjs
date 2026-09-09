import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Roadmap 10.1c and 10.0b7, ladder D16. Every guard in this repository
// is a plain .mjs script that reads the disk, and NOTHING runs one
// except a test file: ci.yml runs `npm test`, and vitest.config.ts
// collects test/**/*.test.ts. So a guard whose test is deleted,
// renamed, or simply never written is a file that looks like a control
// and enforces nothing, and no build anywhere goes red.
//
// This is the reader behind the guard on the guards. It lives here
// rather than in the test because the test tsconfig has no node types,
// so `readdirSync` in a .test.ts is `any` and every callback beside it
// loses its type — which is how a guard silently stops guarding, one
// layer down.
//
// UNTIL 10.0b7 IT ANSWERED BOTH HALVES OF ITS QUESTION FROM FILENAMES.
// A module was a guard if it was CALLED one, matching
// `*(Guard|Block|Ratchet).mjs`, and it was armed if a test file was
// NAMED after it. Both halves were holed, and the second one was
// holed in the live tree. Six rule-carrying modules escaped the name
// pattern — among them `modelProvenance`, `metadataKeys` and this file
// itself — and a hand-kept map of "tests named for what they check"
// sent `bundleGuard` to `bundleBudget.test.ts`, which imports
// `bundleBudget.mjs` and nothing else. `bundleGuard.mjs` had a real
// test of its own that nothing watched: deleting it left this suite
// green.
//
// Both halves read what a module IS now. A hand-written `.d.mts` next
// door is what makes a module a rule-carrier, because that file exists
// exactly when a type-checked caller imports the module, and the
// regeneration commands that carry no rules have none. And a module is
// armed when a test IMPORTS it, which is a fact about the two files
// rather than a coincidence of their names. The map is gone; there is
// nothing left to keep by hand.

/**
 * Every rule-carrying module in tools/, by module name, sorted.
 *
 * The mark is the hand-written `.d.mts` sibling. It is written when
 * something type checked imports the module, so it says the module
 * has an interface somebody depends on, which is what makes it worth
 * arming. Filenames say nothing: `modelProvenance` and `metadataKeys`
 * carry as many rules as anything called a Guard, and `readInFull` had
 * to be RENAMED in row 10.0b6 to get itself watched, which should have
 * been the moment this rule changed.
 *
 * `writeVerdictFixtures` is in, alone among the write commands,
 * because a test compiles against its interface. A module a test
 * compiles against is a module a test should reach.
 */
export function declaredModules(root) {
  const names = readdirSync(join(root, "tools"));
  const present = new Set(
    names
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => name.replace(/\.mjs$/, "")),
  );
  return names
    .filter((name) => name.endsWith(".d.mts"))
    .map((name) => name.replace(/\.d\.mts$/, ""))
    .filter((name) => present.has(name))
    .sort();
}

/**
 * Declarations with no module behind them.
 *
 * A `.d.mts` left behind by a delete is a type that lies: callers go on
 * compiling against an interface whose implementation is gone, and this
 * reader would go on counting it. Reported rather than silently
 * dropped, the same way detectorRatchet reports a watched source that
 * has moved.
 */
export function orphanDeclarations(root) {
  const names = readdirSync(join(root, "tools"));
  const present = new Set(
    names
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => name.replace(/\.mjs$/, "")),
  );
  return names
    .filter((name) => name.endsWith(".d.mts"))
    .map((name) => name.replace(/\.d\.mts$/, ""))
    .filter((name) => !present.has(name))
    .sort();
}

/**
 * The tools modules one source file imports, in source order.
 *
 * Anchored on `from "…"`, not on the path anywhere in the text, and
 * that is not a nicety. `claimGuard.test.ts` lists
 * "tools/claimGuard.mjs" among its exemptions, so a reader matching
 * the bare path would treat an exemption list as an import list and
 * count modules as armed by files that never load them — which is
 * this guard making the exact mistake it exists to catch.
 *
 * The pattern spans the line break because almost every import here is
 * a wrapped named-import block.
 */
export function moduleImports(source) {
  return [
    ...source.matchAll(/\bfrom\s*"[^"]*tools\/([A-Za-z0-9_]+)\.mjs"/g),
  ].map((match) => match[1]);
}

/** Every test file under test/, with the tools modules it imports. */
export function testImports(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".test.ts")) {
        found.push({
          file: path,
          modules: moduleImports(readFileSync(join(root, path), "utf8")),
        });
      }
    }
  };
  walk("test");
  return found.sort((a, b) => (a.file < b.file ? -1 : 1));
}

/**
 * The modules nothing imports, as data, so the rule is testable
 * without a repository arranged to fail.
 */
export function unarmed(modules, imported) {
  const reached = new Set(imported);
  return modules.filter((module) => !reached.has(module));
}

/** Rule-carrying modules no test imports, so nothing runs them. */
export function unarmedGuards(root) {
  return unarmed(
    declaredModules(root),
    testImports(root).flatMap((entry) => entry.modules),
  );
}
