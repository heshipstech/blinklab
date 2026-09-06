import { describe, expect, it } from "vitest";

import { guardModules, unarmedGuards } from "../../tools/guardsArmed.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.1c, ladder D16. Every guard in this repository is a plain
// .mjs script that reads the disk, and NOTHING runs one except a
// sibling test file: `ci.yml` runs `npm test`, and `vitest.config.ts`
// collects `test/**/*.test.ts`. So a guard whose test file is deleted,
// renamed, or simply never written is a file that looks like a control
// and enforces nothing, and no build anywhere goes red.
//
// This is the guard on the guards. The count is stated as well as the
// rule, so ADDING a guard is a conscious act: a new file has to be
// counted here on purpose, which is the moment to ask whether the
// thing is actually armed.

const root = repoRoot();

describe("every guard is armed by a test that runs it", () => {
  it("finds the guards on disk rather than trusting a list", () => {
    // A reader that matched nothing would report every guard armed
    // forever, which is the silent success this repository keeps
    // meeting. These three are the oldest and must always be found.
    const modules = guardModules(root);
    expect(modules).toContain("claimGuard");
    expect(modules).toContain("resultGuard");
    expect(modules).toContain("detectorRatchet");
  });

  it("leaves out the regeneration commands, which carry no rules", () => {
    // `writeResultsBlock` and its kin import the generator next door
    // and write its output to disk. The generator has the rules and the
    // sibling test; the writer is a command.
    for (const module of guardModules(root)) {
      expect(module.startsWith("write")).toBe(false);
    }
  });

  it("has a sibling test file for each one", () => {
    const unarmed = unarmedGuards(root);
    expect(unarmed, `these guards run nowhere: ${unarmed.join(", ")}`).toEqual(
      [],
    );
  });

  it("states how many there are, so adding one is a conscious act", () => {
    // Bump this deliberately when a guard is added, and use the bump as
    // the moment to check the new guard is actually reached by its test
    // rather than merely imported by it.
    expect(guardModules(root)).toHaveLength(14);
  });
});
