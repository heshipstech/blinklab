import { describe, expect, it } from "vitest";

import {
  statedEyeblink8,
  unreleasedSection,
} from "../../tools/changelogGuard.mjs";
import {
  parseResultFile,
  readRepoFile,
  repoRoot,
} from "../../tools/resultGuard.mjs";

// Roadmap 10.0b4, ladder B17. CHANGELOG was never joined to the
// guarded documents, and it published a headline.
//
// Its Unreleased section has said "87.7% recall, 83.3% precision,
// 85.4% F1" since 15 August 2026. Those are the THIRD of five figures
// this project has published for Eyeblink8, superseded twice since,
// and the file gave no sign of it. Unreleased describes what is about
// to ship, not what shipped, so its figures have to be the current
// ones; the earlier ones live in README's table of five and in the
// result file, both of which keep them on purpose.

const root = repoRoot();
const changelog = readRepoFile("CHANGELOG.md", root);
const result = parseResultFile(readRepoFile("docs/eyeblink8-result.txt", root));

describe("finding the Unreleased section", () => {
  it("takes the text up to the first released version", () => {
    expect(
      unreleasedSection(
        "# C\n\n## Unreleased\n\nwords\n\n## v0.7.0 — later\n\nold\n",
      ),
    ).toContain("words");
    expect(
      unreleasedSection(
        "# C\n\n## Unreleased\n\nwords\n\n## v0.7.0 — later\n\nold\n",
      ),
    ).not.toContain("old");
  });

  it("refuses a changelog with no Unreleased section", () => {
    // Reporting an empty section would read as "nothing is claimed
    // here", which is what a renamed heading also looks like.
    expect(() => unreleasedSection("# C\n\n## v0.7.0\n\nold\n")).toThrow(
      /Unreleased/,
    );
  });
});

describe("reading the Eyeblink8 figures a section states", () => {
  it("takes recall, precision and F1 from the sentence that states them", () => {
    expect(
      statedEyeblink8(
        "blinks: 83.6% recall, 84.0%\nprecision, 83.8% F1. More.",
      ),
    ).toEqual({ recall: "83.6", precision: "84.0", f1: "83.8" });
  });

  it("returns null when the section states no such figures", () => {
    expect(statedEyeblink8("nothing measured here")).toBeNull();
  });

  it("refuses a half-stated triple rather than reporting the half", () => {
    // A sentence that gives recall and precision and drops F1 is a
    // sentence somebody edited. Reporting two thirds of a headline
    // would let the third drift with nothing watching it.
    expect(() =>
      statedEyeblink8("blinks: 83.6% recall, 84.0% precision, and so on."),
    ).toThrow(/F1/);
  });
});

describe("the repository holds its own changelog", () => {
  it("states the current run's figures in Unreleased, not a superseded one", () => {
    const stated = statedEyeblink8(unreleasedSection(changelog));
    expect(stated).toEqual({
      recall: result.recallPercent,
      precision: result.precisionPercent,
      f1: result.f1Percent,
    });
  });

  it("points at the record rather than restating the counts", () => {
    expect(unreleasedSection(changelog)).toContain("docs/eyeblink8-result.txt");
  });
});
