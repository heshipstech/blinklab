import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import {
  assessSession,
  type VerdictInputs,
} from "../../src/core/sessionVerdict";

// The TypeScript half of the verdict pin, increment 5 of the pilot
// (docs/assessment-pilot-plan.md). The committed fixtures under
// test/fixtures/verdict/ hold a synthetic session CSV beside the
// canonical verdict JSON, and BOTH implementations must reproduce
// the JSON byte for byte: this side from the literal inputs below,
// the Python side (analysis/blinklab/verdict.py) from the CSV
// alone. A mutation on either side lands on the same committed
// bytes — mutations both directions, through one file.
//
// The inputs here are the page-state equivalents of what each CSV
// says. If a literal and its CSV ever drift apart, one side stops
// matching the committed JSON, which is the pin doing its job.

const root = repoRoot();

function expected(name: string): string {
  return readRepoFile(`test/fixtures/verdict/${name}-verdict.json`, root);
}

function canonical(inputs: VerdictInputs): string {
  return `${JSON.stringify(assessSession(inputs), null, 2)}\n`;
}

function goodInputs(): VerdictInputs {
  return {
    calibration: {
      kind: "ready",
      baselineMm: 7.9,
      window: {
        sampleCount: 301,
        medianMm: 7,
        p90Mm: 7.9,
        spreadRatio: 1.129,
        ceilingBound: false,
        baselineMm: 7.9,
      },
    },
    cameraOutcome: { kind: "running" },
    sampledFps: 60,
    processingFps: 60,
    visibilityChanges: 0,
    markedWindow: { widthSeconds: 13.5, interruptionsInside: 0 },
    poseValidFraction: 0.98,
    rulerFitShown: "fits",
    modelTrusted: true,
  };
}

describe("the shared verdict fixture", () => {
  it("the good session reproduces the committed bytes", () => {
    expect(canonical(goodInputs())).toBe(expected("good"));
  });

  it("the refused session reproduces the committed bytes", () => {
    const inputs = goodInputs();
    inputs.calibration = {
      kind: "refused",
      window: {
        sampleCount: 301,
        medianMm: 7,
        p90Mm: 9.65,
        spreadRatio: 1.378,
        ceilingBound: true,
        baselineMm: 9.65,
      },
    };
    // A refused session has no ruler, so the fit check never
    // settles: the CSV's baselineMm column is empty and this side
    // says the same thing as null.
    inputs.rulerFitShown = null;
    expect(canonical(inputs)).toBe(expected("refused"));
  });

  it("the degraded session reproduces the committed bytes", () => {
    const inputs = goodInputs();
    // Safari's shape: sampling unreported, so the evidence rate
    // falls back to the processing rate and says whose rate it is.
    inputs.sampledFps = null;
    inputs.processingFps = 30;
    inputs.visibilityChanges = 2;
    // Both interruptions before marker 1: the window itself is
    // undisturbed and says so, while the interruptions surface warns.
    inputs.markedWindow = { widthSeconds: 13.5, interruptionsInside: 0 };
    inputs.poseValidFraction = 0.62;
    inputs.rulerFitShown = "tooLong";
    inputs.calibration = {
      kind: "ready",
      baselineMm: 9,
      window: {
        sampleCount: 301,
        medianMm: 7,
        p90Mm: 9,
        spreadRatio: 1.18,
        ceilingBound: false,
        baselineMm: 9,
      },
    };
    expect(canonical(inputs)).toBe(expected("degraded"));
  });

  it("the export path derives no verdict", () => {
    // DERIVED, NEVER EXPORTED: the page may not hand the exporter a
    // verdict, so main.ts must not touch the verdict module at all
    // today. Increment 6 renders the report panel and will import
    // it; this assertion must then narrow to the export path —
    // exportSession and the metadata builders — rather than vanish.
    const main = readRepoFile("src/main.ts", root);
    expect(main).not.toContain("assessSession");
    expect(main).not.toContain("sessionVerdict");
  });
});
