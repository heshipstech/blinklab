import { describe, expect, it } from "vitest";

import {
  buildParticipantReport,
  type ParticipantReportInputs,
} from "../../src/core/participantReport";
import {
  assessSession,
  type VerdictInputs,
} from "../../src/core/sessionVerdict";

// Assessment pilot increment 7 (docs/assessment-pilot-plan.md): the
// GOOD, REFUSED and DEGRADED sessions each have their FULL rendering
// snapshot-tested — the committed files under test/fixtures/report/
// are the whole report, byte for byte, so any wording change anywhere
// in the eight sections shows up as a reviewable diff rather than a
// silent drift. The verdict inputs mirror the increment 5 fixture
// sessions, so one story runs through the CSV, the verdict JSON and
// the report text.

function goodVerdict(): VerdictInputs {
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

function goodInputs(): ParticipantReportInputs {
  return {
    verdict: assessSession(goodVerdict()),
    measured: [
      { label: "Blinks detected", value: { kind: "measured", text: "14" } },
      {
        label: "Blink rate",
        value: { kind: "measured", text: "12.0 per minute" },
      },
      {
        label:
          "PERCLOS (instrument-adjusted threshold, not comparable to " +
          "published PERCLOS)",
        value: { kind: "measured", text: "0.04" },
      },
      { label: "Long closures", value: { kind: "measured", text: "0" } },
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
      {
        label: "Sampled rate (distinct frames this page read)",
        value: { kind: "measured", text: "60.0 frames per second" },
      },
      {
        label: "KSS before",
        value: { kind: "measured", text: "3 of 9" },
      },
      { label: "KSS after", value: { kind: "measured", text: "skipped" } },
      {
        label:
          "Markers (stamped on the record clock, about one second of slack)",
        value: { kind: "measured", text: "2" },
      },
    ],
    truncations: [],
    storedProbe: { present: [], unreadable: [] },
    appCommit: "abc1234",
    generatedAt: "29 August 2026, 23:00",
  };
}

describe("the full report renderings, committed and diffable", () => {
  it("the good session", async () => {
    await expect(buildParticipantReport(goodInputs())).toMatchFileSnapshot(
      "../fixtures/report/good-report.txt",
    );
  });

  it("the refused session", async () => {
    const inputs = goodInputs();
    const verdict = goodVerdict();
    verdict.calibration = {
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
    verdict.rulerFitShown = null;
    inputs.verdict = assessSession(verdict);
    const reason =
      "the calibration was refused, so every number that depends on " +
      "the blink line is withheld rather than guessed";
    inputs.measured = inputs.measured.map((row) =>
      row.label === "Camera"
        ? row
        : { label: row.label, value: { kind: "withheld", reason } },
    );
    inputs.score = null;
    inputs.scoreWithheldReason = reason;
    await expect(buildParticipantReport(inputs)).toMatchFileSnapshot(
      "../fixtures/report/refused-report.txt",
    );
  });

  it("the degraded session", async () => {
    const inputs = goodInputs();
    const verdict = goodVerdict();
    verdict.sampledFps = null;
    verdict.processingFps = 30;
    verdict.visibilityChanges = 2;
    verdict.poseValidFraction = 0.62;
    verdict.rulerFitShown = "tooLong";
    inputs.verdict = assessSession(verdict);
    inputs.truncations = [
      "iris width: computed over the first 20000 frames, later frames " +
        "not sampled",
    ];
    inputs.storedProbe = {
      present: [],
      unreadable: ["blinklab-calibration-profile-v1"],
    };
    inputs.appCommit = null;
    await expect(buildParticipantReport(inputs)).toMatchFileSnapshot(
      "../fixtures/report/degraded-report.txt",
    );
  });
});
