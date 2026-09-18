import { describe, expect, it } from "vitest";

import {
  RECORD_REFUSAL_PREFIX,
  RECORD_WALKTHROUGH_STEPS,
  RECORD_WHY_NOT_HERE,
} from "../../src/core/recordWalkthrough";
import { variableRateRefusal } from "../../src/core/stepCalibration";

// Roadmap 14.6, the walkthrough under the owner's decided fork
// (refusal-first, 18 September 2026): teach the visitor to bring a
// constant-rate file from their device's own camera app, and tell
// them honestly WHY the browser's own recording is refused — by
// quoting the pipeline's real refusal, pinned here against the
// function that actually speaks it, so the walkthrough can never
// describe a sentence the page stopped saying.

describe("the steps a visitor can walk", () => {
  it("three steps: record elsewhere, save honestly, load here", () => {
    expect(RECORD_WALKTHROUGH_STEPS).toHaveLength(3);
    expect(RECORD_WALKTHROUGH_STEPS[0]).toContain("camera app");
    expect(RECORD_WALKTHROUGH_STEPS[1]).toContain("constant frame rate");
    expect(RECORD_WALKTHROUGH_STEPS[2]).toContain("Choose file");
  });
});

describe("the honesty paragraph", () => {
  it("quotes the refusal the pipeline actually speaks", () => {
    const spoken = variableRateRefusal({
      kind: "variableRate",
      offendingGapSeconds: 0.04,
      smallestGapSeconds: 0.033,
    });
    expect(spoken.startsWith(RECORD_REFUSAL_PREFIX)).toBe(true);
    expect(RECORD_WHY_NOT_HERE).toContain(RECORD_REFUSAL_PREFIX);
  });

  it("cites the committed probe rather than asserting from memory", () => {
    expect(RECORD_WHY_NOT_HERE).toContain("docs/record-yourself-probe.txt");
  });

  it("promises a named refusal, never a workaround", () => {
    // The fork the owner declined — a constant-rate recording path in
    // the browser — must not be implied by the walkthrough's wording.
    expect(RECORD_WHY_NOT_HERE.toLowerCase()).not.toContain("we can fix");
    expect(RECORD_WHY_NOT_HERE.toLowerCase()).not.toContain("workaround");
  });
});
