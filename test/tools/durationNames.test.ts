import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 12.0b, the record half of the personal ruler, from ladder
// A9's finding: "blink duration" is ONE column carrying TWO
// quantities. The exported duration is closed time under the
// session's blink line, and that line is one of two rulers — the
// passive baseline-derived line or the person's own guided line —
// that sit 30 to 50 percent apart on the same eyes. Nothing in the
// column said so; only blinkLineSource discriminates. These pins hold
// the two quantities' NAMES into the export's column-header
// documentation and the model card, so a reader comparing durations
// across sessions is told, where the columns are defined, that the
// comparison is conditional on the line source.

const root = repoRoot();
const spec = readRepoFile("SPEC.md", root);
const card = readRepoFile("MODEL_CARD.md", root);

const PASSIVE_NAME = "passive-line duration";
const GUIDED_NAME = "guided-line duration";

describe("the two duration quantities are named where the columns are defined", () => {
  it("names both on the per-second record's duration key", () => {
    const line = spec
      .split("\n")
      .find((l) => l.includes("lastBlinkDurationMs"));
    expect(line).toBeDefined();
    expect(line).toContain(PASSIVE_NAME);
    expect(line).toContain(GUIDED_NAME);
  });

  it("names both for the blink log's durationMs column", () => {
    // The blink log section runs from its heading to the next "## ".
    const start = spec.indexOf("`durationMs`");
    expect(start).toBeGreaterThan(-1);
    const section = spec.slice(start, start + 1200);
    expect(section).toContain(PASSIVE_NAME);
    expect(section).toContain(GUIDED_NAME);
  });

  it("names both in the model card, beside the duration caveats", () => {
    expect(card).toContain(PASSIVE_NAME);
    expect(card).toContain(GUIDED_NAME);
  });

  it("ties the discrimination to the exported line-source column", () => {
    // Naming two quantities without saying which column tells them
    // apart would name a problem and withhold the remedy.
    const cardParagraph = card
      .split("\n\n")
      .find((p) => p.includes(PASSIVE_NAME));
    expect(cardParagraph).toBeDefined();
    expect(cardParagraph).toContain("blinkLineSource");
  });
});
