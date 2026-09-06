import { describe, expect, it } from "vitest";

import {
  buildPrivacyBlock,
  committedPrivacyBlock,
  exportSentence,
  privacySection,
  splicePrivacyBlock,
  storedItems,
} from "../../tools/privacyBlock.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import { STORED_ITEMS } from "../../src/core/storedData";
import { EXPORT_CONTENTS } from "../../src/core/exportContents";

// Roadmap 10.0a2, ladder B2. README's Privacy section said the app
// touched two localStorage keys and that "those two keys are the only
// storage this app touches". The app writes four: the gaze profile,
// the samples it was solved from, a personal blink line and a
// voluntary pseudonym. The two newer keys arrived with their own
// tests, their own erase control and their own entry in the interface,
// and the README paragraph was simply never revisited.
//
// A paragraph that enumerates something is a paragraph that goes stale
// the moment the something grows, so it stops being a paragraph. The
// block is generated from STORED_ITEMS, the same list the page renders
// from, and this test rebuilds it and fails when the committed README
// has drifted. The resultsBlock mechanism, applied to storage.

const root = repoRoot();
const readme = readRepoFile("README.md", root);

describe("the stored items the generator reads", () => {
  it("finds every item the page itself renders", () => {
    const parsed = storedItems(readRepoFile("src/core/storedData.ts", root));
    expect(parsed.map((item) => item.key)).toEqual(
      STORED_ITEMS.map((item) => item.key),
    );
    expect(parsed.map((item) => item.what)).toEqual(
      STORED_ITEMS.map((item) => item.what),
    );
  });

  it("refuses a source it cannot read rather than emitting an empty list", () => {
    // An empty list would generate a Privacy section that says the app
    // stores nothing, which is the original defect with a guard in
    // front of it.
    expect(() => storedItems("export const STORED_ITEMS = [];")).toThrow(
      /storedData/,
    );
  });
});

describe("the export sentence the generator reads", () => {
  it("is the same sentence the page shows", () => {
    expect(
      exportSentence(readRepoFile("src/core/exportContents.ts", root)),
    ).toBe(EXPORT_CONTENTS);
  });
});

describe("the committed Privacy section", () => {
  it("is what the generator would write today", () => {
    expect(committedPrivacyBlock(readme)).toBe(buildPrivacyBlock(root));
  });

  it("names every stored key", () => {
    // The check the roadmap row asks for, stated on its own so a
    // failure reads as "a key is missing" rather than "the block
    // drifted".
    const section = privacySection(readme);
    for (const item of STORED_ITEMS) {
      expect(
        section,
        `README's Privacy section never names ${item.key}`,
      ).toContain(item.key);
    }
  });

  it("says how many keys there are, counted rather than typed", () => {
    expect(privacySection(readme)).toContain(
      `${String(STORED_ITEMS.length)} things`,
    );
  });

  it("no longer claims two keys are all of them", () => {
    expect(privacySection(readme)).not.toContain(
      "the only storage this app touches",
    );
  });

  it("splices only between its own markers, and refuses when they are wrong", () => {
    const spliced = splicePrivacyBlock(
      readme,
      "<!-- privacy:begin -->\nx\n<!-- privacy:end -->",
    );
    expect(spliced).toContain("\nx\n");
    expect(spliced.startsWith("# blinklab")).toBe(true);
    expect(() => splicePrivacyBlock("no markers here", "x")).toThrow(
      /privacy markers/,
    );
  });
});
