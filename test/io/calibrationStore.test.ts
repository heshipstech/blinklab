import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadCalibrationProfile,
  loadCalibrationSamples,
  saveCalibrationProfile,
  saveCalibrationSamples,
} from "../../src/io/calibrationStore";
import type { CalibrationProfile } from "../../src/core/calibrationProfile";

// Remediation B3. localStorage is allowed to throw: reads under
// Safari's blocked-storage settings, writes when the quota is full.
// These calls happen inside the frame loop, so an unguarded throw
// did not lose a profile, it killed the whole measurement session.
// The contract under test: a failed read reports as nothing stored,
// a failed write says so with a false, and neither ever throws.

const PROFILE: CalibrationProfile = {
  horizontal: { slope: 1, intercept: 0 },
  vertical: { slope: 1, intercept: 0 },
};

function stubStorage(behaviour: Partial<Storage>): void {
  vi.stubGlobal("localStorage", behaviour);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("with storage that throws on every touch", () => {
  const throwing = () => {
    throw new Error("SecurityError: storage is disabled");
  };

  it("reads report nothing stored instead of throwing", () => {
    stubStorage({ getItem: throwing as Storage["getItem"] });
    expect(loadCalibrationProfile()).toBeNull();
    expect(loadCalibrationSamples()).toBeNull();
  });

  it("writes say they failed instead of throwing", () => {
    stubStorage({ setItem: throwing as Storage["setItem"] });
    expect(saveCalibrationProfile(PROFILE)).toBe(false);
    expect(saveCalibrationSamples([])).toBe(false);
  });
});

describe("with working storage", () => {
  it("a write reports true and a read round-trips it", () => {
    // The positive halves, so the guards cannot rot into a store
    // that always answers false-and-null while looking guarded.
    const cells = new Map<string, string>();
    stubStorage({
      getItem: ((key: string) => cells.get(key) ?? null) as Storage["getItem"],
      setItem: ((key: string, value: string) => {
        cells.set(key, value);
      }) as Storage["setItem"],
    });
    expect(saveCalibrationProfile(PROFILE)).toBe(true);
    expect(loadCalibrationProfile()).toEqual(PROFILE);
    expect(saveCalibrationSamples([])).toBe(true);
    expect(loadCalibrationSamples()).toEqual([]);
  });

  it("an unparseable stored value reads as nothing, not as a crash", () => {
    // Unparseable only: a value that parses but has the wrong shape
    // still loads, because the cast is unvalidated. Pre-existing,
    // noted in the B3 pull request rather than fixed in it.
    stubStorage({
      getItem: (() => "{not json") as Storage["getItem"],
    });
    expect(loadCalibrationProfile()).toBeNull();
    expect(loadCalibrationSamples()).toBeNull();
  });
});
