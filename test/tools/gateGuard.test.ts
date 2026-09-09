import { describe, expect, it } from "vitest";

import {
  ciGates,
  documentedGates,
  phasesComplete,
  rowSettled,
  statedPhasesComplete,
} from "../../tools/gateGuard.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.0b3, ladder B14 and D13. Two summary sentences in this
// repository restate something a machine-readable file already knows,
// and both were written by hand and left to age.
//
// CONTRIBUTING gives contributors one command line to run before
// opening a pull request, and says the gates below it are the gates
// CI runs. Continuous integration is the file that decides that. A
// gate added to one and not the other means a contributor runs a
// suite that passes and then watches CI fail on a step they were
// never told about.
//
// README says which roadmap phases are complete. ROADMAP is the file
// that decides that. A phase finished, or a new row opened inside a
// finished phase, and the sentence carries on saying what it said.

const root = repoRoot();
const workflow = readRepoFile(".github/workflows/ci.yml", root);
const contributing = readRepoFile("CONTRIBUTING.md", root);
const roadmap = readRepoFile("ROADMAP.md", root);
const readme = readRepoFile("README.md", root);

describe("reading the gates out of the workflow", () => {
  it("lists a job's npm gates in the order the job runs them", () => {
    expect(
      ciGates(
        "jobs:\n  checks:\n    steps:\n      - run: npm run lint\n" +
          "      - run: npm test\n",
        "checks",
      ),
    ).toEqual(["npm run lint", "npm test"]);
  });

  it("keeps a named step's command, which is still a gate", () => {
    expect(
      ciGates(
        "jobs:\n  checks:\n    steps:\n      - name: Definition of Done\n" +
          "        run: node tools/checkLearningEntry.mjs abc\n",
        "checks",
      ),
    ).toEqual(["node tools/checkLearningEntry.mjs abc"]);
  });

  it("reads only the job it was asked for", () => {
    const two =
      "jobs:\n  checks:\n    steps:\n      - run: npm run lint\n" +
      "  analysis:\n    steps:\n      - run: uv run pytest\n";
    expect(ciGates(two, "checks")).toEqual(["npm run lint"]);
    expect(ciGates(two, "analysis")).toEqual(["uv run pytest"]);
  });

  it("refuses a job it cannot find rather than reporting no gates", () => {
    // An empty list would read as "this job runs nothing", which is
    // the answer a typo gives and the answer a deleted job gives, and
    // a guard that cannot tell those apart passes on both.
    expect(() =>
      ciGates("jobs:\n  checks:\n    steps: []\n", "nosuch"),
    ).toThrow(/nosuch/);
  });
});

describe("reading the gates out of CONTRIBUTING", () => {
  it("takes the commands from a chained shell line", () => {
    expect(documentedGates("```bash\nnpm run lint && npm test\n```\n")).toEqual(
      ["npm run lint", "npm test"],
    );
  });

  it("ignores a command named in prose, because prose is not an instruction", () => {
    // The hole this row dug for itself and then fell into. An earlier
    // version also read inline code spans, so the paragraph explaining
    // the drift satisfied the pin by naming the gate while explaining
    // it, and deleting that gate from the command line a contributor
    // actually runs left the suite green. A gate counts as documented
    // where it is RUN, not where it is discussed.
    expect(
      documentedGates("We added `npm run counts:check` in September.\n"),
    ).toEqual([]);
  });

  it("collects every fenced block, because the gates are split by language", () => {
    expect(
      documentedGates(
        "```bash\nnpm test\n```\ntext\n```bash\nnode tools/mutationCheck.mjs\n```\n",
      ),
    ).toEqual(["npm test", "node tools/mutationCheck.mjs"]);
  });
});

describe("the repository holds its own summaries", () => {
  it("CONTRIBUTING names every gate the checks job runs", () => {
    const documented = documentedGates(contributing);
    for (const gate of ciGates(workflow, "checks")) {
      // The Definition of Done step and the browser install are not
      // gates a contributor runs locally: one reads the pull request's
      // own commit range, the other is a one-off install. Everything
      // else CI runs, CONTRIBUTING has to say.
      if (
        gate.includes("checkLearningEntry") ||
        gate.includes("playwright install")
      ) {
        continue;
      }
      expect(documented).toContain(gate);
    }
  });

  it("says how many phases are complete, and ROADMAP agrees", () => {
    expect(statedPhasesComplete(readme)).toBe(phasesComplete(roadmap));
  });
});

describe("counting complete phases from the roadmap", () => {
  it("counts the run of finished phases from zero", () => {
    expect(
      phasesComplete(
        "## Phase 0. A\n- [x] 0.1 one\n## Phase 1. B\n- [x] 1.1 one\n" +
          "## Phase 2. C\n- [ ] 2.1 one\n",
      ),
    ).toBe(1);
  });

  it("stops at the first phase with an open row, not the last closed one", () => {
    // A later phase finishing early must not advance the claim past a
    // phase that is still open, which is exactly how a summary comes
    // to overstate what is done.
    expect(
      phasesComplete(
        "## Phase 0. A\n- [x] 0.1 one\n## Phase 1. B\n- [ ] 1.1 one\n" +
          "## Phase 2. C\n- [x] 2.1 one\n",
      ),
    ).toBe(0);
  });

  it("counts a declined row as settled, not as open", () => {
    // This file marks three outcomes. A guard that knew ticks alone
    // would call a finished phase unfinished forever.
    expect(rowSettled("~", "8.8 DECLINED 15 August. The floor is met.")).toBe(
      true,
    );
    expect(
      phasesComplete("## Phase 0. A\n- [x] 0.1 one\n- [~] 0.2 declined\n"),
    ).toBe(0);
  });

  it("counts a row moved elsewhere as settled", () => {
    expect(rowSettled(" ", "8.1 (moved to 7.0, see amendments)")).toBe(true);
    expect(
      phasesComplete(
        "## Phase 0. A\n- [x] 0.1 one\n- [ ] 0.2 (moved to 7.0, see amendments)\n",
      ),
    ).toBe(0);
  });

  it("does not let prose about moving something settle a row", () => {
    // Matched at the head of the row and in the file's own words, so
    // an unticked row that happens to discuss moving work stays open.
    expect(
      rowSettled(" ", "8.9 Decide whether this is (moved to) another phase"),
    ).toBe(false);
    expect(rowSettled(" ", "8.9 A row we should have moved to phase 9")).toBe(
      false,
    );
  });

  it("refuses a roadmap with no phase headings", () => {
    expect(() => phasesComplete("- [x] 1.1 one\n")).toThrow(/phase/i);
  });

  it("refuses a phase with no rows at all", () => {
    // An empty phase is vacuously complete, which would let a heading
    // written ahead of its rows advance the published claim.
    expect(() =>
      phasesComplete("## Phase 0. A\n- [x] 0.1 one\n## Phase 1. B\n"),
    ).toThrow(/no rows/i);
  });
});
