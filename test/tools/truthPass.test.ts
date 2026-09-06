import { describe, expect, it } from "vitest";

import { DEMO_NOTICE } from "../../src/core/notice";
import {
  parseAlertnessResult,
  parseSubjectCount,
  readRepoFile,
  repoRoot,
} from "../../tools/resultGuard.mjs";

// Roadmap 10.0a1, ladder B1, B3, B6's dating half, B7 and B13. The
// September audit found the page and the card publishing five
// sentences that were each true when written and false by the time
// they were read: a card that omitted the alertness result the README
// reported, a notice that said the model DOES send after the block
// made that false, a gaze claim with no measurement behind it, a
// cross-engine table with no date, and a reporting channel that is
// switched off.
//
// Correcting them is an afternoon. Keeping them corrected is the hard
// part, which is what this file is: every corrected sentence has a
// POSITIVE pin here, read from the record it came from, so the
// document cannot drift back without a red build. The retired
// phrasings are held out by claimGuard's mechanism; these hold the
// replacements in.

const root = repoRoot();
const card = readRepoFile("MODEL_CARD.md", root);
const readme = readRepoFile("README.md", root);
const security = readRepoFile("SECURITY.md", root);

/** Prose in this repository hard-wraps, so pins compare collapsed text. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ");
}

describe("the alertness result the card publishes", () => {
  it("reads the headline out of the record rather than a memory", () => {
    const result = parseAlertnessResult(
      readRepoFile("docs/alertness-score-result.txt", root),
    );
    expect(result.auc).toBe("0.70");
    expect(result.p).toBe("0.001");
  });

  it("refuses a record whose headline it cannot find", () => {
    expect(() => parseAlertnessResult("no headline here")).toThrow(
      /alertness result/,
    );
  });

  it("is on the card with both numbers and its two limits", () => {
    // The card revised itself one day AFTER the result landed and
    // still omitted it, while the README reported it. Whichever way
    // that gap opens it is the same defect, so the card is held to
    // the record directly.
    const result = parseAlertnessResult(
      readRepoFile("docs/alertness-score-result.txt", root),
    );
    expect(collapse(card)).toContain(`AUC ${result.auc}`);
    expect(collapse(card)).toContain(`p ${result.p}`);
    expect(collapse(card)).toContain("cohort-level");
    expect(collapse(card)).toContain("per person unvalidated");
  });
});

describe("who the instrument has been tested on", () => {
  it("counts the two UTA-RLDD reads separately, as the records do", () => {
    // Two reads of one dataset, two different subject counts: 54
    // survive the frame-rate floor for the leave-one-subject-out
    // classification, 52 for the alertness comparison. A card that
    // printed one number for both would be wrong for one of them.
    const loso = parseSubjectCount(
      readRepoFile("docs/uta-rldd-result.txt", root),
    );
    const alertness = parseSubjectCount(
      readRepoFile("docs/alertness-score-result.txt", root),
    );
    expect(loso).toBe(54);
    expect(alertness).toBe(52);
    expect(collapse(card)).toContain(`${String(loso)} of 60`);
    expect(collapse(card)).toContain(`${String(alertness)} of those`);
  });

  it("names tablets as untested rather than leaving the gap silent", () => {
    // A device class nobody has run is not a device class that works.
    expect(collapse(card)).toContain("Tablets");
    expect(collapse(card)).toContain("no tablet has run this instrument");
  });
});

describe("the notice about the model's usage reporting", () => {
  it("says the request is tried and intercepted, not sent", () => {
    // Since 5 September the block drops it before it leaves the
    // browser, so "does send" is false in the one direction that
    // matters: it understates the protection and overstates the leak.
    expect(DEMO_NOTICE).toContain("tries to send");
    expect(DEMO_NOTICE).toContain(
      "this page intercepts the request before it leaves the browser",
    );
    expect(DEMO_NOTICE).not.toContain("does send");
  });

  it("is quoted verbatim by the README and the card", () => {
    // The audit found six echoes of this sentence in six documents,
    // each reworded a little. One string, quoted, is the only way the
    // page and the documents can be checked against each other.
    expect(collapse(readme)).toContain(collapse(DEMO_NOTICE));
    expect(collapse(card)).toContain(collapse(DEMO_NOTICE));
  });
});

describe("the gaze claim", () => {
  it("says not measured, and names the row that will measure it", () => {
    expect(collapse(card)).toContain("not measured");
    expect(collapse(card)).toContain("MANUAL item 34");
    expect(collapse(readme)).toContain("MANUAL item 34");
  });

  it("no longer publishes a reliability nobody measured", () => {
    for (const [name, text] of [
      ["MODEL_CARD.md", card],
      ["README.md", readme],
    ] as const) {
      expect(
        collapse(text).includes("reliable near the centre"),
        `${name} still claims a gaze reliability that was never measured`,
      ).toBe(false);
      expect(
        collapse(text).includes("reliable in the middle"),
        `${name} still claims a gaze reliability that was never measured`,
      ).toBe(false);
    }
  });
});

describe("the cross-engine table", () => {
  it("carries the date it was measured and the code it was measured on", () => {
    const section = readme.slice(readme.indexOf("## Does it give the same"));
    expect(collapse(section)).toContain("Measured 8 August 2026");
    expect(collapse(section)).toContain("1de3ae4");
  });

  it("says WebKit where the record says WebKit", () => {
    // The corpus runner launches WebKit and nothing else, so a
    // reproduction across two builds of it is not engine independence.
    expect(collapse(readme)).toContain("WebKit binary");
    expect(collapse(card)).toContain("WebKit binary");
    expect(collapse(readme)).toContain(
      "no engine other than WebKit has measured this corpus",
    );
  });
});

describe("the security reporting channel", () => {
  it("does not send reporters to a private report that is switched off", () => {
    expect(collapse(security)).not.toContain("Report a vulnerability");
  });

  it("names the contact the published page already offers", () => {
    expect(collapse(security)).toContain("contact link at the bottom");
    expect(collapse(security)).toContain("verified");
  });
});
