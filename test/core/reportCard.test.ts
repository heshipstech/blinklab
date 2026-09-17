import { describe, expect, it } from "vitest";

import { capabilityLadder } from "../../src/core/capabilityLadder";
import { demoNoticeText } from "../../src/core/notice";
import {
  buildParticipantReport,
  UNVALIDATED_SCORE_SENTENCE,
  type ParticipantReportInputs,
} from "../../src/core/participantReport";
import {
  reportCardModel,
  type ReportCardModel,
} from "../../src/core/reportCard";
import {
  assessSession,
  type VerdictInputs,
} from "../../src/core/sessionVerdict";

// Roadmap 14.4's first Check clause: the parity test against the
// text report. The card is a second surface over the same session,
// and the podium (14.2) already taught the rule for second surfaces:
// they own nothing. Every line the card prints must be a line
// buildParticipantReport prints from the same inputs — withheld
// lines carry their reasons, unknown renders as the word and never
// as an empty cell, and the one card-only sentence is the sentence
// saying what the card leaves out.

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
      { label: "PERCLOS", value: { kind: "unknown" } },
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
    ladder: capabilityLadder({ sampledFps: 55.0, irisWidthPx: 26.0 }),
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

/** Every line the card renders, flattened the way the DOM will print
 * them, EXCEPT the omitted-sentence, which is the one deliberate
 * card-only string and has its own test. */
function cardLines(model: ReportCardModel): string[] {
  return [
    model.title,
    model.notice,
    model.headline,
    ...model.flagged,
    ...model.measured.map((row) => `${row.label}: ${row.value}`),
    model.score,
    model.scoreCaveat,
    ...model.conditions.map((row) => `${row.label}: ${row.value}`),
    ...model.provenance.map((row) => `${row.label}: ${row.value}`),
  ];
}

describe("the printable report card (roadmap 14.4)", () => {
  it("prints nothing the text report does not print, line for line", () => {
    const shared = inputs();
    const report = buildParticipantReport(shared).split("\n");
    for (const line of cardLines(reportCardModel(shared))) {
      expect(report, line).toContain(line);
    }
  });

  it("never renders an absent value as an empty cell", () => {
    for (const line of cardLines(reportCardModel(inputs()))) {
      expect(line.trim()).not.toBe("");
      expect(line).not.toMatch(/: *$/);
    }
  });

  it("renders unknown as the word, on the card as in the report", () => {
    const model = reportCardModel(inputs());
    const perclos = model.measured.find((row) => row.label === "PERCLOS");
    expect(perclos?.value).toBe("unknown");
  });

  it("a withheld line carries its reason", () => {
    const withheld = inputs();
    withheld.measured = [
      {
        label: "Blinks detected",
        value: { kind: "withheld", reason: "the calibration was refused" },
      },
    ];
    const model = reportCardModel(withheld);
    expect(model.measured[0]?.value).toBe(
      "withheld — the calibration was refused",
    );
  });

  it("the withheld score is the report's own line, reason and all", () => {
    const withheld = inputs();
    withheld.score = null;
    withheld.scoreWithheldReason =
      "no minute of usable records existed by the end of the session";
    const model = reportCardModel(withheld);
    expect(model.score).toBe(
      "Alertness score: withheld — no minute of usable records existed " +
        "by the end of the session",
    );
    expect(buildParticipantReport(withheld)).toContain(model.score);
  });

  it("a withheld score without a reason names the defect", () => {
    const withheld = inputs();
    withheld.score = null;
    withheld.scoreWithheldReason = null;
    expect(reportCardModel(withheld).score).toContain(
      "no reason was recorded, which is itself a defect worth reporting",
    );
  });

  it("bad news makes the card: a refused surface prints, an ok one does not", () => {
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
    const model = reportCardModel(refused);
    expect(
      model.flagged.some((line) => line.startsWith("REFUSED — calibration:")),
    ).toBe(true);
    expect(model.flagged.some((line) => line.startsWith("OK — "))).toBe(false);
    // Each flagged line is the report's own, verbatim.
    const report = buildParticipantReport(refused).split("\n");
    for (const line of model.flagged) {
      expect(report, line).toContain(line);
    }
  });

  it("a clean session flags nothing", () => {
    expect(reportCardModel(inputs()).flagged).toEqual([]);
  });

  it("the demo notice is on the card, so the caveat prints with the paper", () => {
    expect(reportCardModel(inputs()).notice).toBe(demoNoticeText());
  });

  it("the score caveat travels with the score", () => {
    expect(reportCardModel(inputs()).scoreCaveat).toBe(
      UNVALIDATED_SCORE_SENTENCE,
    );
  });

  it("the one card-only sentence says what the card is not", () => {
    const model = reportCardModel(inputs());
    const report = buildParticipantReport(inputs());
    expect(report).not.toContain(model.omitted);
    expect(model.omitted).toContain("highlights");
    expect(model.omitted).toContain("text report");
  });
});
