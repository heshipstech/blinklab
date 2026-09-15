import { afterEach, describe, expect, it, vi } from "vitest";

import { playCueTone, vibrateCue } from "../../src/io/cueTone";

// Roadmap 11.6b: the guided calibration's phase boundaries land on the
// ear AND in the hand, because closed eyes cannot read a screen and a
// phone in a palm can say "next step" without either. Both cues are
// aids, never load-bearing: a page with no audio and no vibration
// still cues on screen, so every failure here must be swallowed.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vibrateCue", () => {
  it("pulses the vibration API where the device has one", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    vibrateCue();
    expect(vibrate).toHaveBeenCalledOnce();
    const [pattern] = vibrate.mock.calls[0] as [number];
    expect(pattern).toBeGreaterThan(0);
  });

  it("does nothing, silently, where there is no vibration API", () => {
    // iOS Safari and desktops: navigator exists, vibrate does not.
    vi.stubGlobal("navigator", {});
    expect(() => {
      vibrateCue();
    }).not.toThrow();
  });

  it("swallows a vibration API that throws", () => {
    // Some engines throw on vibrate() without user activation. Losing
    // the buzz must never lose the calibration.
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("no activation");
      },
    });
    expect(() => {
      vibrateCue();
    }).not.toThrow();
  });
});

describe("playCueTone", () => {
  it("survives a page with no AudioContext at all", () => {
    // The guard the module was born with (11.0b), pinned now that a
    // second caller relies on it: screen-only cueing is a complete
    // protocol, so a missing or refusing audio stack must be silent.
    vi.stubGlobal("AudioContext", undefined);
    expect(() => {
      playCueTone();
    }).not.toThrow();
  });
});
