import { describe, expect, it } from "vitest";

import {
  PSEUDONYM_MAX_CHARS,
  STORED_ITEMS,
  type StorageProbe,
  eraseButtonLabel,
  eraseOutcomeMessage,
  hasSomethingToErase,
  normalizePseudonym,
  storedSummary,
} from "../../src/core/storedData";

// Remediation E3. Two keys were written to the visitor's browser from
// the first calibration onwards, nothing on the page said so, and
// there was no way to undo it.
//
// The sentences below are the whole point of the feature, so they are
// pinned as sentences. The case that matters most is the one where the
// browser refuses to be read: reporting that as "nothing is stored"
// would be the one lie a privacy control must never tell, and it is
// the shape of silent success this project keeps rediscovering.

const KEYS = STORED_ITEMS.map((item) => item.key);
const nothing: StorageProbe = { present: [], unreadable: [] };
const both: StorageProbe = { present: KEYS, unreadable: [] };
const one: StorageProbe = { present: [KEYS[0] ?? ""], unreadable: [] };
const refused: StorageProbe = { present: [], unreadable: KEYS };

describe("the list of what is stored", () => {
  it("documents every item with a key, a what and a why", () => {
    expect(STORED_ITEMS.length).toBeGreaterThan(0);
    for (const item of STORED_ITEMS) {
      expect(item.key.startsWith("blinklab-")).toBe(true);
      expect(item.what.length).toBeGreaterThan(0);
      expect(item.why.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate keys, which would double-count a single item", () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
  });

  it("documents the blink calibration key beside the gaze ones", () => {
    // The guided blink calibration (guidedCalibration.ts) writes a
    // personal blink line to this device. Every key the page can write
    // must be listed here, so the erase control and this enumeration
    // cannot fall out of step with the store's ALL_KEYS.
    const item = STORED_ITEMS.find(
      (entry) => entry.key === "blinklab-blink-calibration-v1",
    );
    expect(item).toBeDefined();
    expect(item?.what.length).toBeGreaterThan(0);
    expect(item?.why.length).toBeGreaterThan(0);
  });
});

describe("storedSummary", () => {
  it("says nothing is stored when nothing is", () => {
    expect(storedSummary(nothing)).toBe("Nothing is stored on this device.");
  });

  it("counts what is there against the full list", () => {
    expect(storedSummary(both)).toBe(
      `Stored on this device now: ${STORED_ITEMS.length} of ${STORED_ITEMS.length}.`,
    );
    expect(storedSummary(one)).toBe(
      `Stored on this device now: 1 of ${STORED_ITEMS.length}.`,
    );
  });

  it("refuses to claim a clean device it was not allowed to inspect", () => {
    // The defect this pins: a browser that throws on read must not be
    // folded into "nothing stored". The loaders elsewhere do fold it,
    // correctly, because the page then simply shows as uncalibrated.
    // Here it would be a false all-clear.
    const summary = storedSummary(refused);
    expect(summary).toContain("will not let the page read");
    expect(summary).not.toContain("Nothing is stored");
  });

  it("ignores a key it does not document, so a stray entry cannot inflate the count", () => {
    expect(
      storedSummary({ present: ["some-other-app-key"], unreadable: [] }),
    ).toBe("Nothing is stored on this device.");
  });
});

describe("hasSomethingToErase", () => {
  it("is false on an empty device and true when something is there", () => {
    expect(hasSomethingToErase(nothing)).toBe(false);
    expect(hasSomethingToErase(one)).toBe(true);
  });

  it("is false when storage cannot be read, because nothing can be promised", () => {
    expect(hasSomethingToErase(refused)).toBe(false);
  });
});

describe("eraseButtonLabel", () => {
  it("names the two disabled states differently, because they mean opposite things", () => {
    // The first version of this feature disabled the button and
    // labelled it "nothing stored" whenever it could not read the
    // storage, directly contradicting the summary line above it.
    const empty = eraseButtonLabel(nothing, false);
    const cannotLook = eraseButtonLabel(refused, false);
    expect(empty).toContain("nothing stored");
    expect(cannotLook).toContain("will not let the page look");
    expect(cannotLook).not.toContain("nothing stored");
  });

  it("asks for a second click once armed", () => {
    expect(eraseButtonLabel(both, false)).toBe("Erase stored data");
    expect(eraseButtonLabel(both, true)).toBe("Click again to erase it");
  });

  it("cannot be armed into a promise it will not keep", () => {
    // Armed is a page-side flag. If it somehow survives into a state
    // with nothing to erase, the label must still tell the truth.
    expect(eraseButtonLabel(nothing, true)).toContain("nothing stored");
  });
});

describe("eraseOutcomeMessage", () => {
  it("confirms only when the re-read found nothing left", () => {
    expect(eraseOutcomeMessage(nothing)).toBe(
      "Erased. Nothing is stored on this device now.",
    );
  });

  it("reports a failed erase rather than claiming success", () => {
    // This is the reason the caller re-probes instead of trusting
    // removeItem: a remove that returns quietly and changes nothing is
    // the failure worth catching.
    const message = eraseOutcomeMessage(one);
    expect(message).toContain("did not work");
    expect(message).toContain("1 of");
    expect(message).not.toContain("Erased.");
  });

  it("pluralises honestly", () => {
    expect(eraseOutcomeMessage(one)).toContain("item is");
    expect(eraseOutcomeMessage(both)).toContain("items are");
  });

  it("cannot confirm an erase it was not allowed to verify", () => {
    const message = eraseOutcomeMessage(refused);
    expect(message).toContain("cannot be confirmed");
    expect(message).not.toContain("Erased.");
  });
});

describe("the pseudonym, voluntary identity (pilot increment 8)", () => {
  it("documents the pseudonym key beside the calibration keys", () => {
    // One new stored key, created only by explicit action — never
    // auto-generated on load — preserving the deviceId refusal's
    // principle that identity is voluntary
    // (docs/assessment-pilot-plan.md).
    const item = STORED_ITEMS.find(
      (entry) => entry.key === "blinklab-participant-pseudonym-v1",
    );
    expect(item).toBeDefined();
    expect(item?.what.length).toBeGreaterThan(0);
    expect(item?.why.length).toBeGreaterThan(0);
  });

  it("normalizes a pseudonym to one trimmed line, or says why not", () => {
    // A newline would break the export's one-line metadata row, so
    // whitespace collapses; an empty save is an explicit removal, not
    // a pseudonym of nothing.
    expect(normalizePseudonym("  maple 7  ")).toEqual({
      kind: "ok",
      value: "maple 7",
    });
    expect(normalizePseudonym("a\n b")).toEqual({ kind: "ok", value: "a b" });
    expect(normalizePseudonym("   ")).toEqual({ kind: "none" });
    expect(normalizePseudonym("")).toEqual({ kind: "none" });
  });

  it("refuses an over-long pseudonym rather than truncating it", () => {
    // Truncating silently would export a name the person never chose.
    const long = "x".repeat(PSEUDONYM_MAX_CHARS + 1);
    expect(normalizePseudonym(long)).toEqual({
      kind: "tooLong",
      limit: PSEUDONYM_MAX_CHARS,
    });
    expect(normalizePseudonym("x".repeat(PSEUDONYM_MAX_CHARS))).toEqual({
      kind: "ok",
      value: "x".repeat(PSEUDONYM_MAX_CHARS),
    });
  });
});
