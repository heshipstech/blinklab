import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 14.0c, ladder D15. The Definition-of-done checklist invites
// "n/a" on any line a change does not touch, and an unexplained "n/a" is
// the same silence this project keeps closing elsewhere: a box ticked
// with nothing behind it. So the template itself must ask for a reason
// whenever a line is marked n/a, and this holds the template to that
// ask so it cannot quietly drop out on a later edit.

const template = readRepoFile(".github/pull_request_template.md", repoRoot());

describe("the pull request template", () => {
  it("still carries the Definition of done checklist", () => {
    // The clause below only means something while the checklist it
    // governs is present, so pin that first.
    expect(template).toContain("## Definition of done");
    expect(template).toContain("- [ ]");
  });

  it("requires a reason whenever an item is marked n/a", () => {
    // Robust to wording: somewhere the template pairs "n/a" with a
    // demand for a reason, in either order, on one line.
    const asksForReason = template
      .split("\n")
      .some((line) => /n\/a/i.test(line) && /reason/i.test(line));
    expect(asksForReason).toBe(true);
  });
});
