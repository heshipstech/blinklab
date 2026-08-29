import { describe, expect, it } from "vitest";

import { suspensionRefusal } from "../../src/core/suspensionGuard";

// The guard queued by docs/miss-trace.txt: a stepped clip measured
// through a suspend and resume produced a COMPLETE LOOKING file —
// every frame counted, coverage perfect — with twelve blinks quietly
// wrong inside it. Silent success, the project's oldest enemy. A
// stepped run that observed any visibility change during measurement
// refuses by name instead of exporting.

describe("the suspension guard", () => {
  it("an undisturbed run is not refused", () => {
    expect(suspensionRefusal(0)).toBeNull();
  });

  it("one visibility change during the run refuses by name", () => {
    const reason = suspensionRefusal(1);
    expect(reason).not.toBeNull();
    expect(reason).toContain("hidden or the machine slept");
    expect(reason).toContain("refused rather than exported");
    expect(reason).toContain("1 time");
  });

  it("counts plural changes out loud", () => {
    expect(suspensionRefusal(3)).toContain("3 times");
  });

  it("a negative delta is an impossibility and refuses too", () => {
    // The counter only rises. A negative delta means the baseline
    // was captured wrong, and a guard that shrugs at its own broken
    // input is no guard.
    expect(suspensionRefusal(-1)).not.toBeNull();
  });
});
