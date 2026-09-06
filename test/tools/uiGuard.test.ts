import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import {
  boxHeadings,
  buttonStrings,
  documentedBoxes,
  fossils,
  idleStrings,
  undocumented,
  undocumentedStrings,
} from "../../tools/uiGuard.mjs";

// Remediation F3. docs/UI.md is the compensating control for the
// src/ui folder SPEC.md describes and that has never existed, it
// claims to list every element the page can show, and until now
// nothing could fail when it stopped being true.
//
// It had stopped being true: five boxes described where eight exist,
// Session in a tier of its own when it sits under Alertness, and an
// "Instrument" box that had become the footer of Live signals.

const root = repoRoot();
const main = readRepoFile("src/main.ts", root);
const uiDoc = readRepoFile("docs/UI.md", root);
const idleSource = readRepoFile("src/core/idleStrings.ts", root);

describe("reading the page's button and idle strings", () => {
  // Roadmap 14.0b. The box check held docs/UI.md to the page's
  // headings; three button labels and every idle string had drifted
  // out of it unnoticed, because nothing read them.
  it("finds every button label the page assigns", () => {
    const found = buttonStrings(main);
    expect(found).toContain("Start camera");
    expect(found).toContain("Light response");
    expect(found).toContain("Recalibrate blinks");
    expect(found.length).toBeGreaterThan(10);
  });

  it("reads the idle table out of core, not out of main", () => {
    const found = idleStrings(idleSource);
    expect(found).toContain("Alertness score: not measuring");
    expect(found.length).toBeGreaterThan(10);
  });

  it("reports the strings the document does not carry", () => {
    expect(
      undocumentedStrings(
        ["Start camera", "Brand new button"],
        "`Start camera`",
      ),
    ).toEqual(["Brand new button"]);
    expect(
      undocumentedStrings(["Start camera"], "Click Start camera."),
    ).toEqual([]);
  });
});

describe("reading the boxes out of the page", () => {
  it("finds boxes written on one line and boxes written across several", () => {
    // box() is called both ways in main.ts. A pattern that matched only
    // the single-line form would find five of the eight and report
    // success, which is this repository's recurring failure mode.
    const oneLine = boxHeadings('const a = box("Alertness", label);');
    const multiLine = boxHeadings('const b = box(\n  "Source",\n  input,\n);');
    expect(oneLine).toEqual(["Alertness"]);
    expect(multiLine).toEqual(["Source"]);
  });

  it("finds every box the real page builds", () => {
    const found = boxHeadings(main);
    // The floor pins that the reader keeps finding real calls, so a
    // broken pattern cannot return nothing and agree with everything.
    expect(found.length).toBeGreaterThanOrEqual(8);
    expect(new Set(found).size).toBe(found.length);
  });

  it("reads the document's own box headings, at either depth", () => {
    expect(documentedBoxes("### 5.2 Box: Source\n#### Box: Eyes\n")).toEqual([
      "Source",
      "Eyes",
    ]);
  });
});

describe("docs/UI.md and the page agree", () => {
  it("documents every box the page builds", () => {
    expect(
      undocumented(main, uiDoc),
      "boxes in main.ts with no section in docs/UI.md",
    ).toEqual([]);
  });

  it("describes no box the page has stopped building", () => {
    // The "Instrument" fossil is what this would have caught. A
    // section describing something that no longer exists is worse
    // than a missing one: it reads as current.
    expect(
      fossils(main, uiDoc),
      "boxes documented in docs/UI.md that main.ts no longer builds",
    ).toEqual([]);
  });

  it("documents every button label and every idle string", () => {
    expect(
      undocumentedStrings(buttonStrings(main), uiDoc),
      "button labels in main.ts that docs/UI.md never mentions",
    ).toEqual([]);
    expect(
      undocumentedStrings(idleStrings(idleSource), uiDoc),
      "idle strings in core that docs/UI.md never mentions",
    ).toEqual([]);
  });

  it("catches a drift in each direction", () => {
    // Proof the two checks above can fail, without mutating the repo.
    const pageGainedABox = 'box("Alertness", x); box("Brand New", y);';
    const docHasOnlyOne = "#### Box: Alertness\n";
    expect(undocumented(pageGainedABox, docHasOnlyOne)).toEqual(["Brand New"]);
    expect(fossils('box("Alertness", x);', "#### Box: Instrument\n")).toEqual([
      "Instrument",
    ]);
  });
});
