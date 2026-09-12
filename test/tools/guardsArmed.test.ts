import { describe, expect, it } from "vitest";

import {
  declaredModules,
  moduleImports,
  orphanDeclarations,
  testImports,
  unarmed,
  unarmedGuards,
} from "../../tools/guardsArmed.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.1c and 10.0b7, ladder D16. Every guard in this repository
// is a plain .mjs that reads the disk, and NOTHING runs one except a
// test file: `ci.yml` runs `npm test`, and `vitest.config.ts` collects
// `test/**/*.test.ts`. So a guard whose test is deleted, renamed, or
// never written is a file that looks like a control and enforces
// nothing, and no build anywhere goes red.
//
// This is the guard on the guards, and until 10.0b7 it answered both
// halves of its question from FILENAMES: a module was a guard if it
// was CALLED one, and armed if a test was NAMED after it. Both halves
// were holed. Six modules carrying a hand-written `.d.mts` escaped the
// name pattern, and a hand-kept map sent `bundleGuard` to a test file
// that imports `bundleBudget.mjs` and nothing else — so `bundleGuard`'s
// own test was watched by nothing, and deleting it left this suite
// green.
//
// Both halves now read what a module IS. A hand-written `.d.mts` is
// what makes a module a rule-carrier: it exists because a type-checked
// caller imports the thing, and the regeneration commands that carry
// no rules have none. And a module is armed when a test IMPORTS it,
// which is a fact about the two files rather than about their names.

const root = repoRoot();

describe("what counts as a rule-carrying module", () => {
  it("reads the declaration rather than the name", () => {
    const modules = declaredModules(root);
    expect(modules).toContain("claimGuard");
    expect(modules).toContain("resultGuard");
    expect(modules).toContain("detectorRatchet");
  });

  it("includes the six the old name pattern missed", () => {
    // Every one of these carries rules and a sibling test today, and
    // every one of them was invisible to the guard on the guards
    // because of what it is called. `guardsArmed` itself was among
    // them, which is the joke this row exists to stop being.
    const modules = declaredModules(root);
    for (const module of [
      "modelProvenance",
      "bundleBudget",
      "metadataKeys",
      "wilson",
      "writeVerdictFixtures",
      "guardsArmed",
    ]) {
      expect(modules).toContain(module);
    }
  });

  it("leaves out the regeneration commands, which declare nothing", () => {
    // `writeStatusBlock` and its kin import the generator next door and
    // write its output to disk. The generator has the rules, the
    // declaration and the test; the writer is a command and carries no
    // `.d.mts` at all. `writeVerdictFixtures` is the exception and is
    // deliberately IN: a test compiles against its interface, so it
    // has a declaration, and a module a test compiles against is a
    // module that should be reached by one.
    const modules = declaredModules(root);
    for (const module of [
      "writeStatusBlock",
      "writeResultsBlock",
      "writeCannotSeeBlock",
      "writePrivacyBlock",
      "writeReadStamps",
    ]) {
      expect(modules).not.toContain(module);
    }
    expect(modules).toContain("writeVerdictFixtures");
  });

  it("has no declaration without a module behind it", () => {
    // A `.d.mts` left behind by a delete is a type that lies: callers
    // still compile, and the thing they compile against is gone.
    expect(orphanDeclarations(root)).toEqual([]);
  });

  it("states how many there are, so adding one is a conscious act", () => {
    // Bump this deliberately when a module is added, and use the bump
    // as the moment to ask whether the test reaches the module rather
    // than merely importing it, which is the one thing a static reader
    // still cannot tell.
    expect(declaredModules(root)).toHaveLength(28);
  });
});

describe("reading which modules a test file imports", () => {
  it("finds the module behind an import", () => {
    expect(
      moduleImports('import { a } from "../../tools/claimGuard.mjs";'),
    ).toEqual(["claimGuard"]);
  });

  it("finds every module in a file, not just the first", () => {
    const source = [
      'import { a } from "../../tools/claimGuard.mjs";',
      'import { b } from "../../tools/resultGuard.mjs";',
    ].join("\n");
    expect(moduleImports(source)).toEqual(["claimGuard", "resultGuard"]);
  });

  it("survives an import broken across lines, which most of them are", () => {
    const source = [
      "import {",
      "  RETIRED_CLAIMS,",
      "  relapses,",
      '} from "../../tools/claimGuard.mjs";',
    ].join("\n");
    expect(moduleImports(source)).toEqual(["claimGuard"]);
  });

  it("ignores a module named in a string rather than imported", () => {
    // This is not hypothetical. `claimGuard.test.ts` lists
    // "tools/claimGuard.mjs" in its exemptions, and a reader matching
    // the path anywhere would count that file as arming every module
    // its exemption list happens to name.
    expect(moduleImports('const EXEMPT = ["tools/claimGuard.mjs"];')).toEqual(
      [],
    );
  });

  it("ignores imports that are not from tools", () => {
    expect(
      moduleImports('import { blink } from "../../src/core/blink";'),
    ).toEqual([]);
  });
});

describe("armed means imported, not named alike", () => {
  it("reports a module no test imports", () => {
    expect(unarmed(["alpha", "beta"], ["beta"])).toEqual(["alpha"]);
  });

  it("reports nothing when every module is imported", () => {
    expect(unarmed(["alpha"], ["alpha", "beta"])).toEqual([]);
  });

  it("finds every rule-carrying module reached by a test today", () => {
    const missing = unarmedGuards(root);
    expect(missing, `these modules run nowhere: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("would go red if bundleGuard's own test were deleted", () => {
    // The case that proved the old rule holed. A hand-kept map sent
    // `bundleGuard` to `bundleBudget.test.ts`, which imports
    // `bundleBudget.mjs` and nothing else, so this suite stayed green
    // with `bundleGuard`'s real test removed. Under the import rule it
    // does not: deleting the one file that imports the module leaves
    // the module unarmed, which is the whole point of the guard.
    const importers = testImports(root).filter((entry) =>
      entry.modules.includes("bundleGuard"),
    );
    expect(importers.map((entry) => entry.file)).toEqual([
      "test/tools/bundleGuard.test.ts",
    ]);
    const withoutIt = testImports(root)
      .filter((entry) => entry.file !== "test/tools/bundleGuard.test.ts")
      .flatMap((entry) => entry.modules);
    expect(unarmed(["bundleGuard"], withoutIt)).toEqual(["bundleGuard"]);
  });
});
