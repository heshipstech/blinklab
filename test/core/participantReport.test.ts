import { describe, expect, it } from "vitest";

import { CALIBRATION_REFUSED_SENTENCE } from "../../src/core/baseline";
import { CANNOT_SEE_CLAIMS } from "../../src/core/cannotSee";
import { demoNoticeText } from "../../src/core/notice";
import { PROTOCOL_ID } from "../../src/core/sessionMetadata";
import {
  assessSession,
  type VerdictInputs,
} from "../../src/core/sessionVerdict";
import {
  buildParticipantReport,
  renderReportValue,
  reportAvailable,
  type ParticipantReportInputs,
} from "../../src/core/participantReport";

// Assessment pilot increment 6 (docs/assessment-pilot-plan.md): the
// participant report, one plain-text rendering built pure so the
// in-page panel and the exported file (increment 7) are the same
// bytes. Eight sections in the plan's order, refusals first, the
// three absence renderings pinned distinct, no absent value ever a
// zero, and the report renders ONLY after the camera stops.

function goodVerdictInputs(): VerdictInputs {
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
    cameraOutcome: { kind: "idle" },
    sampledFps: 60,
    processingFps: 60,
    visibilityChanges: 0,
    markedWindow: { widthSeconds: 13.5, interruptionsInside: 0 },
    poseValidFraction: 0.98,
    rulerFitShown: "fits",
    modelTrusted: true,
  };
}

function inputs(): ParticipantReportInputs {
  return {
    verdict: assessSession(goodVerdictInputs()),
    measured: [
      { label: "Blinks detected", value: { kind: "measured", text: "14" } },
      {
        label: "Blink rate",
        value: { kind: "measured", text: "12.0 per minute" },
      },
      {
        label:
          "PERCLOS (instrument-adjusted, not comparable to published PERCLOS)",
        value: { kind: "measured", text: "0.04" },
      },
      { label: "Long closures", value: { kind: "notApplicable" } },
    ],
    score: {
      score: 85,
      contributions: [
        { name: "Eyes-closed share", points: 15, available: true },
        { name: "Long closures", points: 0, available: true },
        { name: "Blink duration", points: 0, available: false },
        { name: "Sluggish lids", points: 0, available: true },
      ],
    },
    scoreWithheldReason: null,
    conditions: [
      { label: "Camera", value: { kind: "measured", text: "Fixture Cam" } },
      { label: "KSS before", value: { kind: "unknown" } },
    ],
    truncations: [],
    storedProbe: { present: [], unreadable: [] },
    appCommit: "abc1234",
    generatedAt: "29 August 2026, 22:50",
  };
}

describe("the participant report", () => {
  it("renders the eight sections in the plan's order", () => {
    const report = buildParticipantReport(inputs());
    const headings = [
      "1. WHAT THIS IS",
      "2. WAS THIS MEASUREMENT SOUND?",
      "3. WHAT WAS MEASURED",
      "4. CONDITIONS",
      "5. WHAT WAS WITHHELD, REFUSED, OR TRUNCATED",
      "6. WHAT THIS INSTRUMENT CANNOT SEE",
      "7. YOUR DATA AND YOUR CONTROL",
      "8. PROVENANCE",
    ];
    let cursor = -1;
    for (const heading of headings) {
      const at = report.indexOf(heading);
      expect(at, heading).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("carries the demo notice verbatim and the unvalidated-score sentence", () => {
    const report = buildParticipantReport(inputs());
    expect(report).toContain(demoNoticeText());
    // The model card's own words: any mention of the score travels
    // with them.
    expect(report).toContain(
      "never been shown to correspond to how sleepy anyone actually is",
    );
  });

  it("a refused calibration leads section 2, verbatim, a result not a failure", () => {
    const refused = inputs();
    const verdictInputs = goodVerdictInputs();
    verdictInputs.calibration = {
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
    refused.verdict = assessSession(verdictInputs);
    const report = buildParticipantReport(refused);
    // The report may not paraphrase the refusal: the pinned sentence
    // itself, byte for byte.
    expect(report).toContain(CALIBRATION_REFUSED_SENTENCE);
    expect(report).toContain("a result, not a failure");
    // Refusals first: the refused finding appears before any ok one.
    const refusedAt = report.indexOf("REFUSED — calibration");
    const firstOk = report.indexOf("OK — ");
    expect(refusedAt).toBeGreaterThan(-1);
    expect(firstOk).toBeGreaterThan(refusedAt);
  });

  it("renders the three absences distinctly, and never as a zero", () => {
    expect(renderReportValue({ kind: "withheld", reason: "no ruler" })).toBe(
      "withheld — no ruler",
    );
    expect(renderReportValue({ kind: "unknown" })).toBe("unknown");
    expect(renderReportValue({ kind: "notApplicable" })).toBe("not applicable");
    for (const value of [
      { kind: "withheld", reason: "no ruler" } as const,
      { kind: "unknown" } as const,
      { kind: "notApplicable" } as const,
    ]) {
      expect(renderReportValue(value)).not.toContain("0");
      expect(renderReportValue(value)).not.toBe("");
    }
  });

  it("shows the score's working: 100 minus the named penalties", () => {
    const report = buildParticipantReport(inputs());
    expect(report).toContain("Alertness score: 85 of 100.");
    expect(report).toContain("Eyes-closed share: -15 points");
    // An unavailable signal is named as absent, never scored as
    // alertness.
    expect(report).toContain(
      "Blink duration: unavailable — absence is not scored as alertness",
    );
  });

  it("a withheld score renders its reason and no number", () => {
    const withheld = inputs();
    withheld.score = null;
    withheld.scoreWithheldReason =
      "the calibration was refused, so every ruler-dependent number is withheld";
    const report = buildParticipantReport(withheld);
    expect(report).toContain("Alertness score: withheld — the calibration");
    expect(report).not.toContain("of 100.");
  });

  it("carries every generated cannot-see claim", () => {
    const report = buildParticipantReport(inputs());
    for (const claim of CANNOT_SEE_CLAIMS) {
      expect(report).toContain(claim.claim);
    }
  });

  it("accounts for all eight surfaces in section 5", () => {
    const report = buildParticipantReport(inputs());
    const section = report.slice(
      report.indexOf("5. WHAT WAS WITHHELD"),
      report.indexOf("6. WHAT THIS INSTRUMENT"),
    );
    for (const surface of [
      "calibration",
      "evidenceRate",
      "interruptions",
      "rulerFit",
      "cameraOutcome",
      "pose",
      "modelTrust",
      "markedWindow",
    ]) {
      expect(section).toContain(surface);
    }
  });

  it("declares truncations verbatim, exactly as the file does", () => {
    const truncated = inputs();
    truncated.truncations = [
      "blink log: kept the first 2000 of 2481 detections",
    ];
    expect(buildParticipantReport(truncated)).toContain(
      "kept the first 2000 of 2481 detections",
    );
  });

  it("says plainly that nothing left the device, and lists the storage", () => {
    const report = buildParticipantReport(inputs());
    expect(report).toContain("Nothing you recorded left this device.");
    expect(report).toContain("Nothing is stored on this device.");
    const unreadable = inputs();
    unreadable.storedProbe = {
      present: [],
      unreadable: ["blinklab-calibration-profile-v1"],
    };
    // Unreadable is never folded into absent: Safari's lockdown mode
    // must not read as a clean device.
    expect(buildParticipantReport(unreadable)).toContain(
      "will not let the page read its own storage",
    );
  });

  it("carries the provenance: protocol, commit, generated on device", () => {
    const report = buildParticipantReport(inputs());
    expect(report).toContain(PROTOCOL_ID);
    expect(report).toContain("App commit: abc1234");
    expect(report).toContain("29 August 2026, 22:50");
    const uncommitted = inputs();
    uncommitted.appCommit = null;
    expect(buildParticipantReport(uncommitted)).toContain(
      "App commit: unknown",
    );
  });

  it("the report is available only after the camera stops, with records", () => {
    expect(reportAvailable("running", 120)).toBe(false);
    expect(reportAvailable("requesting", 120)).toBe(false);
    expect(reportAvailable("loadingClip", 120)).toBe(false);
    expect(reportAvailable("idle", 0)).toBe(false);
    expect(reportAvailable("idle", 120)).toBe(true);
    // A failed session with records still gets its report: refusals
    // lead, and a failure is a result.
    expect(reportAvailable("measurementFailed", 120)).toBe(true);
  });
});
