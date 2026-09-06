import { describe, expect, it } from "vitest";

import {
  buildCannotSeeClaims,
  claimsWithoutPins,
} from "../../tools/cannotSeeBlock.mjs";
import { unpinnedLiterals } from "../../tools/resultsBlock.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.0a3, ladder B5. The two generators exist so that
// published prose cannot drift from the record it describes, and both
// had sentences that were neither parsed from a document nor pinned to
// one: bare template text, frozen the day it was typed and kept green
// by tests that asserted the template rather than the fact.
//
// The clearest case was the miss mechanism. The generator emitted "The
// mechanism is unexplained" into the participant report, the README
// and the model card, while docs/iris-occlusion.txt had explained it
// on 2 September: two landmark signals are both flat on those
// closures, so they are a recall ceiling rather than a tunable defect.
// A generator that freezes a sentence is a slower version of the
// hand-maintained prose it replaced.
//
// So every claim a generator emits must now be one of two things: a
// sentence built around a value parsed out of a document, or a
// sentence pinned by an exact quote to the document that supports it.
// These tests hold both generators to that, from the generator's own
// declarations rather than by reading its prose.

const root = repoRoot();

describe("the cannot-see generator", () => {
  it("pins every claim it emits to a sentence in a real document", () => {
    const claims = buildCannotSeeClaims(root);
    expect(claims.length).toBeGreaterThan(0);
    for (const entry of claims) {
      expect(
        entry.pins.length,
        `the claim starting "${entry.claim.slice(0, 40)}" has no pin`,
      ).toBeGreaterThan(0);
      for (const pin of entry.pins) {
        const source = readRepoFile(pin.path, root);
        expect(
          source.replace(/\s+/g, " ").includes(pin.quote.replace(/\s+/g, " ")),
          `${pin.path} no longer contains ${JSON.stringify(pin.quote)}`,
        ).toBe(true);
      }
    }
  });

  it("names an unpinned claim rather than emitting it", () => {
    // The mechanism, exercised on a claim this test invents, so the
    // refusal is proven without waiting for someone to add a bad one.
    expect(
      claimsWithoutPins([
        { claim: "a sentence nobody sourced", source: "nowhere", pins: [] },
      ]),
    ).toEqual(["a sentence nobody sourced"]);
    expect(
      claimsWithoutPins([
        {
          claim: "a sourced one",
          source: "x.txt",
          pins: [{ quote: "q", path: "x.txt" }],
        },
      ]),
    ).toEqual([]);
  });

  it("says the misses are a measured ceiling, not an unexplained gap", () => {
    const claims = buildCannotSeeClaims(root);
    const miss = claims.find((entry) =>
      entry.claim.startsWith("Ordinary blinks it simply misses"),
    );
    expect(miss).toBeDefined();
    expect(miss?.claim).toContain("ceiling");
    expect(miss?.claim).not.toContain("mechanism is unexplained");
    expect(miss?.source).toContain("docs/iris-occlusion.txt");
  });
});

describe("the results-block generator", () => {
  it("sees the bullets at all, so a green result is not a broken reader", () => {
    // A pattern that matched nothing would report zero offenders
    // forever, which is the silent-success failure this repository
    // keeps meeting. Fed a bullet with no parsed value, it must name
    // it.
    expect(
      unpinnedLiterals(
        '    "- **Limitations, stated plainly:** typed by hand.",\n',
      ),
    ).toEqual(["Limitations, stated plainly:** typed by hand."]);
    expect(
      unpinnedLiterals("    `- **Something:** ${parsed} from a document`,\n"),
    ).toEqual([]);
  });

  it("emits no bullet that is neither parsed nor pinned", () => {
    // A bullet with no `${...}` in it carries no number from any
    // document, so it can only be held up by a quote. This reads the
    // generator's own source and reports the offenders by their first
    // words.
    expect(
      unpinnedLiterals(readRepoFile("tools/resultsBlock.mjs", root)),
    ).toEqual([]);
  });
});
