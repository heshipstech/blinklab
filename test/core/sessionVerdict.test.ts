import { describe, expect, it } from "vitest";

import { CALIBRATION_REFUSED_SENTENCE } from "../../src/core/baseline";
import {
  assessSession,
  type VerdictInputs,
} from "../../src/core/sessionVerdict";

// Assessment pilot increment 3 (docs/assessment-pilot-plan.md): one
// pure object assembling the per-session refusal surfaces, each a
// closed status with its reason sentence. Unknown and not-applicable
// are distinct everywhere, refusals outrank everything in the
// headline, and the verdict is DERIVED, never exported — Python
// re-derives it from primary facts in a later increment.

function good(): VerdictInputs {
  return {
    calibration: {
      kind: "ready",
      baselineMm: 7.9,
      window: {
        sampleCount: 301,
        medianMm: 7,
        p90Mm: 7.9,
        spreadRatio: 1.1286,
        ceilingBound: false,
        baselineMm: 7.9,
      },
    },
    cameraOutcome: { kind: "running" },
    sampledFps: 60,
    processingFps: 61,
    visibilityChanges: 0,
    markedWindow: { widthSeconds: 18, interruptionsInside: 0 },
    poseValidFraction: 0.98,
    rulerFitShown: "fits",
    modelTrusted: true,
  };
}

function surface(inputs: VerdictInputs, name: string) {
  const found = assessSession(inputs).surfaces.find(
    (entry) => entry.surface === name,
  );
  if (found === undefined) throw new Error(`no ${name} surface`);
  return found;
}

describe("the session verdict", () => {
  it("a good session is ok on every surface, and says so positively", () => {
    const verdict = assessSession(good());
    expect(verdict.headline).toBe("ok");
    for (const finding of verdict.surfaces) {
      expect(finding.status).toBe("ok");
    }
    // Zero interruptions is asserted positively, never implied by
    // silence — the plan's own sentence.
    expect(surface(good(), "interruptions").sentence).toContain(
      "stayed visible throughout",
    );
  });

  it("a refused calibration leads the verdict with the pinned sentence", () => {
    const inputs = good();
    inputs.calibration = {
      kind: "refused",
      window: {
        sampleCount: 301,
        medianMm: 7.51,
        p90Mm: 10.35,
        spreadRatio: 1.3782,
        ceilingBound: true,
        baselineMm: 9.3875,
      },
    };
    const verdict = assessSession(inputs);
    expect(verdict.headline).toBe("refused");
    const calibration = surface(inputs, "calibration");
    expect(calibration.status).toBe("refused");
    // The report may not paraphrase the refusal: the finding carries
    // the test-pinned sentence itself.
    expect(calibration.sentence).toBe(CALIBRATION_REFUSED_SENTENCE);
  });

  it("a never-frozen window is unknown, not ok and not refused", () => {
    const inputs = good();
    inputs.calibration = { kind: "learning", startedAtMs: 0, samples: [] };
    expect(surface(inputs, "calibration").status).toBe("unknown");
    const absent = good();
    absent.calibration = null;
    expect(surface(absent, "calibration").status).toBe("unknown");
  });

  it("the evidence rate refuses below the gate floor and warns in the risk band", () => {
    const slow = good();
    slow.sampledFps = 22;
    expect(surface(slow, "evidenceRate").status).toBe("refused");
    const risky = good();
    risky.sampledFps = 30;
    expect(surface(risky, "evidenceRate").status).toBe("warned");
    const missing = good();
    missing.sampledFps = null;
    missing.processingFps = null;
    expect(surface(missing, "evidenceRate").status).toBe("unknown");
  });

  it("pins both rate floors at their literal boundaries", () => {
    // Roadmap 10.1c's rule applied here early (audit F-018): probes
    // derived from the constants pass at any value, so these are
    // literals. 25 is the gate, 60 the risk band, both inclusive on
    // the safe side.
    const at = (sampledFps: number) => {
      const inputs = good();
      inputs.sampledFps = sampledFps;
      return surface(inputs, "evidenceRate");
    };
    expect(at(24.9).status).toBe("refused");
    expect(at(25).status).toBe("warned");
    expect(at(59.9).status).toBe("warned");
    expect(at(60).status).toBe("ok");
    // A rate that reads 25.0 is not below 25: the sentence that once
    // said "25.0 ... below the 25" cannot be produced (roadmap 10.15).
    expect(at(25).sentence).not.toContain("below the 25");
  });

  it("interruptions warn with their count", () => {
    const inputs = good();
    inputs.visibilityChanges = 2;
    inputs.markedWindow = { widthSeconds: 18, interruptionsInside: 0 };
    const finding = surface(inputs, "interruptions");
    expect(finding.status).toBe("warned");
    expect(finding.sentence).toContain("2");
  });

  it("an interruption inside the marked window refuses the window", () => {
    const inputs = good();
    inputs.visibilityChanges = 1;
    inputs.markedWindow = { widthSeconds: 18, interruptionsInside: 1 };
    expect(surface(inputs, "markedWindow").status).toBe("refused");
  });

  it("a zero-width marked window refuses to score", () => {
    const inputs = good();
    inputs.markedWindow = { widthSeconds: 0, interruptionsInside: 0 };
    expect(surface(inputs, "markedWindow").status).toBe("refused");
  });

  it("no marked window is not-applicable, distinct from unknown", () => {
    const inputs = good();
    inputs.markedWindow = null;
    expect(surface(inputs, "markedWindow").status).toBe("notApplicable");
    // Interruptions that cannot be attributed to a phase are unknown
    // on the window, never silently ok.
    const unattributed = good();
    unattributed.visibilityChanges = 1;
    unattributed.markedWindow = { widthSeconds: 18, interruptionsInside: null };
    expect(surface(unattributed, "markedWindow").status).toBe("unknown");
  });

  it("a too-long ruler warns and a missing fit verdict is unknown", () => {
    const long = good();
    long.rulerFitShown = "tooLong";
    expect(surface(long, "rulerFit").status).toBe("warned");
    const missing = good();
    missing.rulerFitShown = null;
    expect(surface(missing, "rulerFit").status).toBe("unknown");
  });

  it("an ended session is the ordinary outcome, the same as running", () => {
    // Roadmap 14.0a: Stop and a finished clip land in "ended", and a
    // report drawn there must not read the end as a failure or an
    // unknown. The fixture written before the state existed still
    // says "running" for the same outcome.
    const inputs = good();
    inputs.cameraOutcome = { kind: "ended" };
    const finding = surface(inputs, "cameraOutcome");
    expect(finding.status).toBe("ok");
    expect(finding.sentence).toContain("without a camera failure");
    expect(assessSession(inputs).headline).toBe("ok");
  });

  it("a broken session outcome refuses, carrying its reason", () => {
    const inputs = good();
    inputs.cameraOutcome = { kind: "measurementFailed", reason: "boom" };
    const finding = surface(inputs, "cameraOutcome");
    expect(finding.status).toBe("refused");
    expect(finding.sentence).toContain("boom");
  });

  it("a camera that stopped mid-session is a failure, carrying its reason", () => {
    // Roadmap 14.0d: the session kept its record, so it is over in
    // the ended sense, but a camera that died is a camera failure and
    // the verdict must not call it the ordinary outcome.
    const inputs = good();
    inputs.cameraOutcome = {
      kind: "cameraStopped",
      reason: "no frames in the last 5 s",
    };
    const finding = surface(inputs, "cameraOutcome");
    expect(finding.status).toBe("refused");
    expect(finding.sentence).toContain("no frames in the last 5 s");
  });

  it("a distrusted model refuses its surface", () => {
    const inputs = good();
    inputs.modelTrusted = false;
    expect(surface(inputs, "modelTrust").status).toBe("refused");
  });

  it("pose reports its fraction without inventing a threshold", () => {
    // No benchmark of pose-valid fractions exists to choose a line
    // from, and per-frame gating already refused the invalid frames;
    // the surface states the fraction and judges nothing.
    const inputs = good();
    inputs.poseValidFraction = 0.62;
    const finding = surface(inputs, "pose");
    expect(finding.status).toBe("ok");
    expect(finding.sentence).toContain("62");
    const missing = good();
    missing.poseValidFraction = null;
    expect(surface(missing, "pose").status).toBe("unknown");
  });

  it("the headline takes the worst status: refused over warned over unknown", () => {
    const warned = good();
    warned.visibilityChanges = 1;
    warned.markedWindow = { widthSeconds: 18, interruptionsInside: 0 };
    expect(assessSession(warned).headline).toBe("warned");
    const alsoRefused = good();
    alsoRefused.visibilityChanges = 1;
    alsoRefused.markedWindow = { widthSeconds: 18, interruptionsInside: 1 };
    expect(assessSession(alsoRefused).headline).toBe("refused");
    const unknownOnly = good();
    unknownOnly.rulerFitShown = null;
    expect(assessSession(unknownOnly).headline).toBe("unknown");
  });

  it("every surface appears exactly once, whatever the inputs", () => {
    const surfaces = assessSession(good()).surfaces.map(
      (entry) => entry.surface,
    );
    expect(new Set(surfaces).size).toBe(surfaces.length);
    expect(surfaces.length).toBe(8);
  });
});
