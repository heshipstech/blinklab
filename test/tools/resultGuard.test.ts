import { describe, expect, it } from "vitest";

import {
  actualPythonTestCount,
  actualUnitTestCount,
  parseResultFile,
  readRepoFile,
  repoRoot,
  statedPythonTestCount,
  statedUnitTestCount,
} from "../../tools/resultGuard.mjs";

// The August 2026 audit found every headline number right and the prose
// around them rotten: the reproduction command printed the retired
// 82.8%, the withdrawn-glasses paragraph printed the superseded run's
// split while calling it corrected, and three documents carried two
// different test counts, 442 and 461, neither the suite's. Each sentence was true once and the run
// changed underneath it.
//
// These tests hold the summary documents to the committed result file,
// docs/eyeblink8-result.txt, so drifting from it is a red build rather
// than a finding in the next audit.

const root = repoRoot();
const run = parseResultFile(readRepoFile("docs/eyeblink8-result.txt", root));

const readme = readRepoFile("README.md", root);
const state = readRepoFile("STATE.md", root);
const modelCard = readRepoFile("MODEL_CARD.md", root);
const architecture = readRepoFile("ARCHITECTURE.md", root);

describe("parseResultFile", () => {
  it("reads the current run, which sits above the superseded one", () => {
    // The file keeps old runs below the current one on purpose, so a
    // parser that grabbed the LAST match would resurrect a retired
    // number. Pin the shape rather than the values: found blinks out of
    // annotated, and the miss subset inside the miss total.
    expect(run.found).toBeGreaterThan(0);
    expect(run.found).toBeLessThanOrEqual(run.annotated);
    expect(run.missFullyClosed).toBeLessThanOrEqual(run.missTotal);
    expect(run.reproDir.startsWith("eyeblink8-measured-")).toBe(true);
  });

  it("refuses a result file it cannot parse, rather than skipping", () => {
    expect(() => parseResultFile("not a result file")).toThrow(
      /could not find/,
    );
  });
});

describe("the summary documents agree with the result file", () => {
  it("README, STATE and MODEL_CARD all carry the current recall and precision", () => {
    for (const doc of [readme, state, modelCard]) {
      expect(doc).toContain(`${run.recallPercent}%`);
      expect(doc).toContain(`${run.precisionPercent}%`);
    }
  });

  it("README's glasses paragraph uses the current run's split", () => {
    expect(readme).toContain(`${run.glasses.recall}% recall`);
    expect(readme).toContain(`${run.noGlasses.precision}%`);
  });

  it("STATE's reproduction command points at the run the file reports", () => {
    // This is the defect that motivated the guard: the command printed
    // 82.8% because it still named the retired dataset directory.
    const commandBlock = state.slice(
      state.indexOf("## How the Track A number is produced"),
    );
    expect(commandBlock).toContain(run.reproDir);
  });

  it("README and MODEL_CARD carry the rebuilt miss figure, not the retired one", () => {
    expect(readme).toContain(`${run.missPercent}%`);
    expect(modelCard).toContain(`${run.missPercent}%`);
    expect(modelCard).toContain(
      `${run.missFullyClosed} of the ${run.missTotal}`,
    );
  });
});

describe("published test counts match the suites", () => {
  it("counts this suite the way the runner does", () => {
    // If the static count ever disagrees with what `vitest run` reports,
    // this guard is counting wrong and every doc check after it is
    // meaningless. The runner reported 486 when this was written; the
    // floor pins that the walker keeps finding real files, so a broken
    // walker cannot return 0 and quietly agree with everything.
    expect(actualUnitTestCount(root)).toBeGreaterThanOrEqual(486);
  });

  it("every document that states a unit test count states the real one", () => {
    const actual = actualUnitTestCount(root);
    for (const [name, doc] of [
      ["README.md", readme],
      ["STATE.md", state],
      ["ARCHITECTURE.md", architecture],
    ] as const) {
      const stated = statedUnitTestCount(doc);
      if (stated !== null) {
        expect(stated, `${name} states ${stated} unit tests`).toBe(actual);
      }
    }
  });

  it("every document that states a Python test count states the real one", () => {
    const actual = actualPythonTestCount(root);
    for (const doc of [readme, state]) {
      const stated = statedPythonTestCount(doc);
      if (stated !== null) {
        expect(stated).toBe(actual);
      }
    }
  });
});
