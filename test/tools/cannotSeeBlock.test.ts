import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import {
  assertQuote,
  buildCannotSeeModule,
} from "../../tools/cannotSeeBlock.mjs";

// Assessment pilot increment 2 (docs/assessment-pilot-plan.md): the
// "what this instrument cannot see" block is GENERATED from the
// published record, never hand-maintained — the resultsBlock
// mechanism applied to caveats. The committed module must be byte
// for byte what the generator produces today, every claim is
// quote-pinned against the exact sentence in its source document,
// and a build missing a required number or the DROZY citation
// refuses rather than emitting a weaker block.

const root = repoRoot();

describe("the generated cannot-see block", () => {
  it("the committed module is exactly what the generator produces", () => {
    expect(readRepoFile("src/core/cannotSee.ts", root)).toBe(
      buildCannotSeeModule(root),
    );
  });

  it("carries the DROZY citation, the permission's condition", () => {
    expect(buildCannotSeeModule(root)).toContain(
      "Massoz, Langohr, Francois and Verly, WACV 2016",
    );
  });

  it("carries the fresh ground truth the plan requires", () => {
    const module = buildCannotSeeModule(root);
    // The deterministic miss, the device difference, the adjusted
    // PERCLOS, the censored log: the plan names all four as the
    // block's non-negotiable content.
    expect(module).toContain("67");
    expect(module).toContain("408");
    expect(module).toMatch(/not comparable/);
    expect(module).toMatch(/censored/);
  });

  it("a quote absent from its source refuses the build", () => {
    expect(() =>
      assertQuote("some source text", "a sentence that is not there", "x.txt"),
    ).toThrow("x.txt");
  });

  it("a quote survives its source's line wrapping", () => {
    // Source documents hard-wrap prose, so the checker collapses
    // whitespace on both sides before comparing: a claim must not
    // fail its pin because a sentence breaks across lines.
    expect(() =>
      assertQuote(
        "the future is\n   not available at birth",
        "the future is not available at birth",
        "x.txt",
      ),
    ).not.toThrow();
  });
});
