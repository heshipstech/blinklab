import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import { asExported } from "../../src/core/participantReport";
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

  it("the edge session reproduces the committed bytes through the file's own rounding", () => {
    // Roadmap 10.15 (audit G-export/l-1). The export writes sampled_fps
    // to one decimal, so a measured 24.96 reaches the file as "25.0"
    // and the Python mirror reads 25.0: warned, not refused. The page
    // used to hand the verdict the raw double and said refused for
    // the same session, and pilot.py stopped the whole cohort calling
    // that disagreement an instrument defect. The inputs here are
    // what the page now hands over: the rate as the file has it.
    const inputs = goodInputs();
    inputs.sampledFps = asExported(24.96, 1);
    expect(canonical(inputs)).toBe(expected("edge"));
    // The mechanism, stated: the raw double lands on the other side
    // of the floor. This line is why the rounding must happen on the
    // page, not only in the file.
    const raw = goodInputs();
    raw.sampledFps = 24.96;
    expect(JSON.parse(canonical(raw)).headline).toBe("refused");
  });

  it("the page hands the verdict the rate as the export writes it", () => {
    // The wiring pin: participantVerdictInputs must round sampledFps
    // through asExported, exactly as it already does for the marker
    // seconds, so both implementations compute from one number.
    const main = readRepoFile("src/main.ts", root);
    const start = main.indexOf("function participantVerdictInputs");
    const end = main.indexOf("processingFps:", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = main.slice(start, end);
    expect(body).toContain("asExported(rates.sampledFps, 1)");
  });

  it("the export path derives no verdict", () => {
    // DERIVED, NEVER EXPORTED: the report panel (increment 6) may
    // assess the session, but the exporter may not — a summary that
    // travelled beside its inputs would eventually disagree with
    // them. So the guard narrowed from "main.ts never touches the
    // verdict" to "exportSession's body never does", exactly as its
    // earlier form instructed.
    const main = readRepoFile("src/main.ts", root);
    const start = main.indexOf("function exportSession");
    const end = main.indexOf("// The participant report");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const exportBody = main.slice(start, end);
    expect(exportBody).not.toContain("assessSession");
    expect(exportBody).not.toContain("buildParticipantReport");
    // And the metadata builders stay fact-only: the pure module the
    // exporter composes rows from must not import the verdict.
    const metadata = readRepoFile("src/core/sessionMetadata.ts", root);
    expect(metadata).not.toContain("sessionVerdict");
  });

  it("one fact, one capture: the session's delivery rates", () => {
    // The dry run's instrument defect (docs/pilot-dry-run.txt): the
    // sampled rate appeared as three numbers because three consumers
    // each called deliveryRates() at their own moment against a
    // rolling window. The export, the report's verdict and the
    // report's conditions must all read ONE capture, so main.ts may
    // carry exactly two live call sites: the on-screen readout while
    // running, and the single settled capture everything else reads.
    const main = readRepoFile("src/main.ts", root);
    const calls = main.match(/deliveryRates\(/g) ?? [];
    expect(calls.length).toBe(2);
    expect(main).toContain("function settledDeliveryRates");
  });

  it("the capture happens at the session's end, before the observer stops", () => {
    // Roadmap 14.0d (audit A18): captured by the first consumer, the
    // rate depended on how fast the operator clicked after Stop. The
    // Stop handler and the camera-stopped route both settle it while
    // the observer's window still holds the last five seconds.
    const main = readRepoFile("src/main.ts", root);
    expect(main).toMatch(
      /settledDeliveryRates\(\);\n\s*setState\(\{ kind: "ended" \}\);/,
    );
    expect(main).toMatch(
      /settledDeliveryRates\(\);\n\s*setState\(\{ kind: "cameraStopped", reason \}\);/,
    );
  });
});
