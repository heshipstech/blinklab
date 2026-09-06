import { describe, expect, it } from "vitest";

import {
  RETIRED_CLAIMS,
  relapses,
  repoRoot,
  trackedFilesMatching,
} from "../../tools/claimGuard.mjs";

// Six files claimed this page sent nothing anywhere, and one of them was
// the notice printed on the page. All six were false: the vendored
// MediaPipe bundle posts usage statistics to Google sixty seconds after
// the face model loads. ADR-0004 is the record.
//
// These tests are the reason it cannot come back quietly.

const root = repoRoot();

// The audit's own files quote the retired wording, because describing
// what was wrong is their whole job. They are named rather than pattern
// matched, so a new document cannot exempt itself by choosing a path.
const EXEMPT = [
  // ADR-0002 claimed "zero runtime third party calls" as the benefit of
  // vendoring. That turned out to be false, and ADR-0004 records it.
  // The file stays exactly as merged because an architecture decision
  // record is a dated statement of what was decided and believed then;
  // editing one to match what was learned later destroys the only thing
  // it is for. It is superseded, not corrected.
  "decisions/ADR-0002-model-hosting.md",
  "AUDIT_REPORT_AUG_2026.md",
  "docs/audit/chunk-2-core-purity.md",
  "docs/audit/appendix-chunk-2-all-findings.md",
  "docs/audit/appendix-chunk-5-all-findings.md",
  // The September 2026 appendix quotes the retired wording while
  // filing the finding that PROJECT.md restated it one word away.
  // Roadmap 10.1c widened the guard to a family of wordings, which is
  // what brought this file into range.
  "docs/audit/2026-09-06-appendix-all-findings.md",
  "tools/claimGuard.mjs",
  "tools/claimGuard.d.mts",
  "test/tools/claimGuard.test.ts",
];

describe("retired claims stay retired", () => {
  it("names why each phrase is banned, so a failure explains itself", () => {
    expect(RETIRED_CLAIMS.length).toBeGreaterThanOrEqual(3);
    for (const claim of RETIRED_CLAIMS) {
      expect(claim.pattern.length).toBeGreaterThan(0);
      expect(claim.says.length).toBeGreaterThan(0);
      expect(claim.because.length).toBeGreaterThan(0);
    }
  });

  it("finds no retired claim anywhere it could mislead a reader", () => {
    const found = relapses(root, EXEMPT);
    // Printed rather than counted, so a failure says which sentence came
    // back and in which file.
    expect(found).toEqual([]);
  });

  it("would notice if one came back", () => {
    // The guard's own guard. The audit report quotes every retired
    // phrase on purpose, so searching without the exemptions must find
    // something. If this ever returns nothing, the search has broken and
    // the test above is passing for the wrong reason.
    expect(relapses(root, []).length).toBeGreaterThan(0);
  });

  it("searches new files too, since that is where a new claim appears", () => {
    // This guard passed locally and failed in CI the first time it ran,
    // because the ADR describing the problem was not yet added and
    // `git grep` without --untracked could not see it.
    const hits = trackedFilesMatching("blinklab", root);
    expect(hits.length).toBeGreaterThan(5);
  });

  it("searches tracked files, so nothing hides in an ignored folder", () => {
    const hits = trackedFilesMatching("blinklab", root);
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((f) => !f.startsWith("node_modules/"))).toBe(true);
  });

  // Roadmap 10.1c, ladder D16. The guard matched fixed strings, so
  // "no data leaves your device" was banned and "No data leaves the
  // device, at any time, for any reason" sat in PROJECT.md untouched:
  // the same claim, one word away, stronger than the one that was
  // measured false. A family of wordings needs a family of patterns.
  it("catches the retired claim in its other wordings, not one spelling", () => {
    // The pattern itself, exercised on the strings rather than on the
    // disk, so a repository that happens to be clean cannot make this
    // pass for the wrong reason.
    const family = new RegExp(RETIRED_CLAIMS[0]?.pattern ?? "", "i");
    expect(family.test("no data leaves your device")).toBe(true);
    expect(family.test("No data leaves the device, at any time")).toBe(true);
    expect(family.test("No data ever leaves this device")).toBe(true);
    expect(family.test("your video and your measurements never leave")).toBe(
      false,
    );
  });
});
