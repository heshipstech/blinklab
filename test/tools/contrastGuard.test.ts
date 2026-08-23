import { describe, expect, it } from "vitest";

import {
  AA_NORMAL_TEXT,
  checkPairs,
  colorTokenUsedBy,
  contrastRatio,
  readTokens,
  relativeLuminance,
} from "../../tools/contrastGuard.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 8.8 was declined on 15 August because "all text clears WCAG
// contrast". Nothing checked that, and it stopped being true the next
// day, when the processing-rate warning shipped in --accent at 2.80:1.
// This is the check that decline assumed already existed.

const root = repoRoot();
const tokens = readTokens(root);

describe("the arithmetic, pinned against values computed by hand", () => {
  it("matches the WCAG worked examples", () => {
    // Black and white are the two ends of the scale and the only two
    // ratios in the spec that need no argument: 21:1 exactly.
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 6);
    // Luminance of pure white is 1 and of pure black is 0, by
    // definition, which catches a transposed coefficient.
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 9);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 9);
    // A mid grey, derived from the formula rather than copied from a
    // checker: 128/255 through the sRGB transfer curve is
    // ((0.50196 + 0.055) / 1.055) ^ 2.4 = 0.2158605, and the three
    // channel weights sum to one so the grey's luminance IS that.
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2158605, 6);
  });

  it("is symmetric, because contrast has no direction", () => {
    expect(contrastRatio("#0f172a", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#0f172a"),
      9,
    );
  });

  it("refuses a colour it cannot read rather than guessing", () => {
    expect(() => relativeLuminance("#fff")).toThrowError(/six-digit/);
    expect(() => relativeLuminance("rebeccapurple")).toThrowError(/six-digit/);
  });
});

describe("every pair the page renders text in clears AA", () => {
  it("finds the tokens it is going to judge", () => {
    // A guard that silently judges nothing is worse than no guard.
    for (const name of ["ink", "body", "muted", "surface", "page", "accent"]) {
      expect(tokens[name], `--${name} missing from src/styles.css`).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }
  });

  it("clears 4.5:1 on every pair, on both grounds", () => {
    const failures = checkPairs(tokens)
      .filter((pair) => !pair.passes)
      .map(
        (pair) =>
          `--${pair.fg} on --${pair.bg} (${pair.where}) = ${pair.ratio.toFixed(2)}`,
      );
    expect(failures, failures.join("; ")).toEqual([]);
  });

  it("keeps the bar at AA, so the guard cannot be disarmed quietly", () => {
    // A mutation showed the threshold is the one number that can turn
    // this guard off without turning anything red: lower it and every
    // pair passes. Pinned to the WCAG value so lowering the bar is
    // itself a failing test.
    expect(AA_NORMAL_TEXT).toBe(4.5);
  });

  it("checks that the page USES the legible tokens, not just that they exist", () => {
    // The hole a mutation found: reverting .rate-warning to --accent
    // left every pair in the palette passing and the caveat
    // unreadable again. A legible palette the page does not use is
    // not a legible page.
    expect(colorTokenUsedBy(root, ".rate-warning")).toBe("accent-text");
    expect(colorTokenUsedBy(root, "#status-banner.alerting")).toBe("ink");
  });

  it("refuses a selector it cannot find rather than passing", () => {
    expect(() => colorTokenUsedBy(root, ".no-such-rule")).toThrowError(
      /no rule for/,
    );
  });

  it("holds the honesty caveat to the same bar as everything else", () => {
    // Named separately because it is the one that matters most and the
    // one that failed: "limitations belong in the open" is a house
    // rule, and a caveat rendered below AA is not in the open.
    const warning = checkPairs(tokens).filter(
      (pair) => pair.fg === "accent-text",
    );
    expect(warning.length).toBe(2);
    for (const pair of warning) {
      expect(pair.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });
});
