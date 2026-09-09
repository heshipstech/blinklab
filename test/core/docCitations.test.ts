import { describe, expect, it } from "vitest";

import {
  citationSegments,
  citedDocs,
  docUrl,
} from "../../src/core/docCitations";
import { REPOSITORY_URL } from "../../src/core/pageIdentity";

// Roadmap 14.0f2 [E7]. The page cites its own evidence and gives no way
// to reach it.
//
// The conditions sentences beside the blink count and the PERCLOS share
// end in `(docs/sampling-bounds.txt)` and the like: a path, in plain
// text, on a page served from a domain where that path means nothing.
// The honesty apparatus this project spent phases building — the
// committed measurements, the pre-registered predictions, the results
// that came back wrong — is one click from the visitor and the click
// does not exist.
//
// So the citations become links, and they are pinned to the commit the
// page was BUILT from rather than to a branch. A link to `main` shows a
// reader today's document beside a number measured last week, which is
// the same class of defect as a stale figure. The build already stamps
// its commit into a meta tag for exactly this kind of question.

describe("finding the documents a sentence cites", () => {
  it("finds a citation in parentheses, the form the page uses", () => {
    expect(
      citedDocs("the term is at most ±0.002 (docs/sampling-bounds.txt); the"),
    ).toEqual(["docs/sampling-bounds.txt"]);
  });

  it("finds one that ends a sentence, without eating the full stop", () => {
    // The dot family this repository has now been bitten by twice. In a
    // document about software the sentence-ending dot and the
    // extension-separating dot are the same character, so a reader that
    // treats a dot as a terminator truncates every path, and one that
    // treats it as part of the path swallows the punctuation.
    expect(citedDocs("Measured in docs/blink-sample-rate.txt.")).toEqual([
      "docs/blink-sample-rate.txt",
    ]);
  });

  it("finds a markdown citation as well as a text one", () => {
    expect(citedDocs("see docs/pupil-light-plan.md now")).toEqual([
      "docs/pupil-light-plan.md",
    ]);
  });

  it("finds every citation in a sentence, not just the first", () => {
    expect(
      citedDocs(
        "at most ±0.002 (docs/sampling-bounds.txt); what bounds it is " +
          "the noise floor (docs/aperture-noise-floor.txt), not the rate.",
      ),
    ).toEqual(["docs/sampling-bounds.txt", "docs/aperture-noise-floor.txt"]);
  });

  it("says nothing about a sentence that cites nothing", () => {
    expect(citedDocs("the count is a floor, not a count")).toEqual([]);
  });
});

describe("splitting a sentence into what to render", () => {
  it("returns one text segment when there is no citation", () => {
    expect(citationSegments("plain words")).toEqual([
      { kind: "text", text: "plain words" },
    ]);
  });

  it("keeps the words on both sides of a citation", () => {
    expect(citationSegments("before (docs/a.txt) after")).toEqual([
      { kind: "text", text: "before (" },
      { kind: "doc", path: "docs/a.txt" },
      { kind: "text", text: ") after" },
    ]);
  });

  it("drops no empty segment when a citation ends the sentence", () => {
    // An empty text node renders as nothing and reads in a test as a
    // difference, so the segments say only what there is to say.
    expect(citationSegments("see docs/a.txt")).toEqual([
      { kind: "text", text: "see " },
      { kind: "doc", path: "docs/a.txt" },
    ]);
  });

  it("reassembles into exactly the sentence it was given", () => {
    // The property that matters: rendering the segments must not change
    // one character of a sentence that core owns and tests pin.
    const sentence =
      "at most ±0.002 (docs/sampling-bounds.txt); the noise floor " +
      "(docs/aperture-noise-floor.txt), not the frame rate.";
    const rebuilt = citationSegments(sentence)
      .map((segment) => (segment.kind === "text" ? segment.text : segment.path))
      .join("");
    expect(rebuilt).toBe(sentence);
  });
});

describe("where a citation points", () => {
  it("pins the link to the commit the page was built from", () => {
    expect(docUrl("docs/sampling-bounds.txt", "5132cf2")).toBe(
      `${REPOSITORY_URL}/blob/5132cf2/docs/sampling-bounds.txt`,
    );
  });

  it("falls back to main for a build that came from a working tree", () => {
    // The vite plugin writes "dev" when GITHUB_SHA is absent, which is
    // the honest answer for a local build. There is no commit to pin to,
    // so the link goes to main and the person following it is the person
    // who has the working tree anyway.
    expect(docUrl("docs/sampling-bounds.txt", "dev")).toBe(
      `${REPOSITORY_URL}/blob/main/docs/sampling-bounds.txt`,
    );
  });

  it("falls back to main when the page carries no stamp at all", () => {
    expect(docUrl("docs/sampling-bounds.txt", null)).toBe(
      `${REPOSITORY_URL}/blob/main/docs/sampling-bounds.txt`,
    );
  });

  it("refuses a path that is not a citation, rather than linking to it", () => {
    // A link builder that accepts anything is a way to put an arbitrary
    // URL on the page from a string that reached it by accident.
    expect(() => docUrl("../etc/passwd", "5132cf2")).toThrow(/citation/i);
    expect(() => docUrl("src/main.ts", "5132cf2")).toThrow(/citation/i);
  });
});
