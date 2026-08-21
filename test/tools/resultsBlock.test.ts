import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import {
  buildResultsBlock,
  committedResultsBlock,
  parseDrozyResult,
  parseRoundVerdicts,
  spliceResultsBlock,
} from "../../tools/resultsBlock.mjs";

// Roadmap 7.9: the README's results-at-a-glance block is GENERATED
// from the committed result files, and this test is the CI check the
// row asks for. The committed block must be byte for byte what the
// generator produces today, so a result file changing without a
// regeneration is a red build here rather than a stale page; and no
// TODO may survive inside the block.

const root = repoRoot();
const readme = readRepoFile("README.md", root);

describe("the generated results block (roadmap 7.9)", () => {
  it("the committed block is exactly what the generator produces", () => {
    expect(committedResultsBlock(readme)).toBe(buildResultsBlock(root));
  });

  it("no TODO remains in the block", () => {
    expect(committedResultsBlock(readme)).not.toContain("TODO");
  });

  it("the block states the limitations plainly", () => {
    // The row's other half. Presence-checked here so a regeneration
    // that dropped the limitations could not pass as an update.
    expect(committedResultsBlock(readme)).toContain(
      "Limitations, stated plainly",
    );
  });

  it("a drozy file without its citation refuses to build", () => {
    // The DROZY permission requires the citation wherever results
    // appear, in any form, so the generator must refuse a source
    // that lost it rather than publish uncited figures.
    const text = readRepoFile("docs/drozy-result.txt", root).replace(
      /^Cite:.*$/m,
      "",
    );
    expect(() => parseDrozyResult(text)).toThrowError(/citation/);
  });

  it("a drozy file whose null verdict vanished refuses to build", () => {
    // If the result ever stops being a null, this sentence leaves the
    // file, and the build must go red here instead of the README
    // quietly still calling it a null.
    const text = readRepoFile("docs/drozy-result.txt", root).replace(
      "Nothing cleared both bars.",
      "Something cleared both bars.",
    );
    expect(() => parseDrozyResult(text)).toThrowError(/null-verdict/);
  });

  it("a round write-up missing a criterion refuses to build", () => {
    const text = readRepoFile("docs/validation-round.txt", root).replace(
      "2. The baseline does not generalise",
      "2. The baseline is fine actually",
    );
    expect(() => parseRoundVerdicts(text)).toThrowError(/could not find/);
  });

  it("a splice without markers refuses rather than guessing", () => {
    expect(() => spliceResultsBlock("no markers here", "block")).toThrowError(
      /no results markers/,
    );
  });

  it("the verdicts parsed today are the round's published ones", () => {
    // Pinned so a silent change to the write-up's wording that made
    // the parse latch onto the wrong token would be visible as a
    // verdict change here, not only as a diff in prose.
    const verdicts = parseRoundVerdicts(
      readRepoFile("docs/validation-round.txt", root),
    );
    expect(verdicts).toEqual({
      detector: "not met",
      baseline: "FAILED",
      gate: "not met",
    });
  });
});
