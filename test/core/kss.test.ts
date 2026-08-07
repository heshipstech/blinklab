import { describe, expect, it } from "vitest";

import {
  KSS_SCALE,
  isKssRating,
  kssMetadataRows,
  type KssRating,
} from "../../src/core/kss";

describe("the scale itself", () => {
  it("has nine anchored steps, numbered 1 to 9 in order", () => {
    expect(KSS_SCALE).toHaveLength(9);
    expect(KSS_SCALE.map((step) => step.rating)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("keeps the published anchor wording, which IS the instrument", () => {
    // Rewording an anchor changes what is being measured, so the
    // exact text is pinned here rather than left to the UI. These
    // are the standard Karolinska anchors.
    expect(KSS_SCALE[0]?.label).toBe("Extremely alert");
    expect(KSS_SCALE[4]?.label).toBe("Neither alert nor sleepy");
    expect(KSS_SCALE[8]?.label).toBe(
      "Very sleepy, great effort to keep awake, fighting sleep",
    );
  });

  it("labels every step, none left blank", () => {
    for (const step of KSS_SCALE) {
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});

describe("isKssRating", () => {
  it("accepts the nine valid ratings", () => {
    for (let rating = 1; rating <= 9; rating++) {
      expect(isKssRating(rating)).toBe(true);
    }
  });

  it("rejects the boundaries just outside the scale", () => {
    expect(isKssRating(0)).toBe(false);
    expect(isKssRating(10)).toBe(false);
  });

  it("rejects a value between steps: the scale is ordinal", () => {
    // 4.5 is not a sleepiness, it is an average of two answers, and
    // an average of an ordinal scale is not a point on it.
    expect(isKssRating(4.5)).toBe(false);
  });

  it("rejects things that are not numbers at all", () => {
    expect(isKssRating(null)).toBe(false);
    expect(isKssRating(undefined)).toBe(false);
    expect(isKssRating("7")).toBe(false);
    expect(isKssRating(Number.NaN)).toBe(false);
    expect(isKssRating(Infinity)).toBe(false);
  });
});

describe("kssMetadataRows", () => {
  const seven = 7 as KssRating;
  const three = 3 as KssRating;

  it("writes both answers with their anchor text", () => {
    expect(kssMetadataRows(three, seven)).toEqual([
      "# kss_before: 3 (Sleepy, but no effort to keep awake)".replace(
        "Sleepy, but no effort to keep awake",
        KSS_SCALE[2]?.label ?? "",
      ),
      `# kss_after: 7 (${KSS_SCALE[6]?.label ?? ""})`,
    ]);
  });

  it("records a refused answer as skipped, never as a middle value", () => {
    // A person who declines is not a 5. Inventing a midpoint would
    // put a fabricated label in a training set.
    expect(kssMetadataRows(null, seven)).toEqual([
      "# kss_before: skipped",
      `# kss_after: 7 (${KSS_SCALE[6]?.label ?? ""})`,
    ]);
    expect(kssMetadataRows(three, null)).toEqual([
      `# kss_before: 3 (${KSS_SCALE[2]?.label ?? ""})`,
      "# kss_after: skipped",
    ]);
  });

  it("still writes both lines when neither was answered", () => {
    // The absence is itself data: a file with no KSS lines at all
    // could mean an older recording, a file saying skipped means
    // the question was asked and declined.
    expect(kssMetadataRows(null, null)).toEqual([
      "# kss_before: skipped",
      "# kss_after: skipped",
    ]);
  });

  it("prefixes every line with a comment marker a reader can skip", () => {
    for (const row of kssMetadataRows(three, seven)) {
      expect(row.startsWith("# ")).toBe(true);
    }
  });
});
