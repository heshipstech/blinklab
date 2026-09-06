import { readdirSync } from "node:fs";
import { join } from "node:path";

// Roadmap 10.1c, ladder D16. Every guard in this repository is a plain
// .mjs script that reads the disk, and NOTHING runs one except a
// sibling test file: ci.yml runs `npm test`, and vitest.config.ts
// collects test/**/*.test.ts. So a guard whose test is deleted,
// renamed, or simply never written is a file that looks like a control
// and enforces nothing, and no build anywhere goes red.
//
// This is the reader behind the guard on the guards. It lives here
// rather than in the test because the test tsconfig has no node types,
// so `readdirSync` in a .test.ts is `any` and every callback beside it
// loses its type — which is how a guard silently stops guarding, one
// layer down.

/**
 * Every guard, generator or ratchet in tools/, by module name.
 *
 * The `write*` scripts are excluded on purpose: they are the
 * regeneration commands, each one importing the generator next door,
 * and it is the generator that carries the rules and the sibling test.
 */
export function guardModules(root) {
  return readdirSync(join(root, "tools"))
    .filter((name) => name.endsWith(".mjs"))
    .filter((name) => /(?:Guard|Block|Ratchet)\.mjs$/.test(name))
    .filter((name) => !name.startsWith("write"))
    .map((name) => name.replace(/\.mjs$/, ""))
    .sort();
}

/** Every unit test file's module name, wherever it lives under test/. */
export function testedModules(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".test.ts")) {
        found.push(entry.name.replace(/\.test\.ts$/, ""));
      }
    }
  };
  walk("test");
  return found.sort();
}

/**
 * The two guards whose test is named for what it checks rather than
 * for the module. Named rather than pattern matched, so a third cannot
 * quietly join them.
 */
export const NAMED_DIFFERENTLY = {
  exportGuard: "exportsAreIgnored",
  bundleGuard: "bundleBudget",
};

/** Guards with no sibling test, so nothing runs them. */
export function unarmedGuards(root) {
  const tested = new Set(testedModules(root));
  return guardModules(root).filter(
    (module) => !tested.has(NAMED_DIFFERENTLY[module] ?? module),
  );
}
