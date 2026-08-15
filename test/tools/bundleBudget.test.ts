import { describe, expect, it } from "vitest";

import {
  BUNDLE_BUDGET_BYTES,
  budgetVerdict,
} from "../../tools/bundleBudget.mjs";

// Roadmap 8.7. The failure this is written against is not slow creep,
// it is the one commit that accidentally bundles the 3.7 MB face model
// or the 33 MB WASM folder, both of which are served from public/ on
// purpose. Every test would still pass and the download would be
// twenty times bigger.

const under = [{ name: "index-abc.js", bytes: 200_000 }];
const over = [{ name: "index-abc.js", bytes: 4_000_000 }];

describe("the bundle budget", () => {
  it("passes a bundle inside the ceiling and says the number", () => {
    const result = budgetVerdict(under);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(200_000);
    // Silent success is indistinguishable from never having run.
    expect(result.why).toContain("200.0 kB");
  });

  it("fails a bundle over the ceiling and says by how much", () => {
    const result = budgetVerdict(over);
    expect(result.ok).toBe(false);
    expect(result.why).toContain("exceeds");
    // The message names the likely cause, or a red build is a puzzle.
    expect(result.why).toContain("public/");
  });

  it("sums every chunk rather than judging the largest", () => {
    // A budget that looked only at the biggest file would be satisfied
    // by splitting one oversized bundle in two, which changes what the
    // browser downloads not at all.
    const split = [
      { name: "a.js", bytes: 150_000 },
      { name: "b.js", bytes: 150_000 },
    ];
    expect(budgetVerdict(split).ok).toBe(false);
    expect(budgetVerdict(split).total).toBe(300_000);
  });

  it("treats an empty dist as a failure, not a pass", () => {
    // Zero bytes is trivially under any ceiling. Reporting that as
    // success would turn a missing build into a green check, which is
    // this project's recurring defect in its purest form.
    const result = budgetVerdict([]);
    expect(result.ok).toBe(false);
    expect(result.why).toContain("was the build run?");
  });

  it("respects the boundary exactly", () => {
    expect(budgetVerdict([{ name: "a.js", bytes: 1000 }], 1000).ok).toBe(true);
    expect(budgetVerdict([{ name: "a.js", bytes: 1001 }], 1000).ok).toBe(false);
  });

  it("has headroom over the real bundle, so ordinary work does not trip it", () => {
    // A budget that fails on ordinary work gets raised without being
    // read, and then it is decoration. 217 kB measured 15 August 2026.
    expect(BUNDLE_BUDGET_BYTES).toBeGreaterThan(217_000);
    expect(BUNDLE_BUDGET_BYTES).toBeLessThan(500_000);
  });
});
