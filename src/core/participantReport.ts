import { CANNOT_SEE_CLAIMS } from "./cannotSee";
import type { CameraState } from "./cameraState";
import { demoNoticeText } from "./notice";
import type { ScoreBreakdown } from "./score";
import { PROTOCOL_ID } from "./sessionMetadata";
import type { SessionVerdict, SurfaceStatus } from "./sessionVerdict";
import { STORED_ITEMS, storedSummary, type StorageProbe } from "./storedData";

// The participant report: assessment pilot increment 6
// (docs/assessment-pilot-plan.md). One plain-text rendering, built
// pure, so the in-page panel and the exported file (increment 7)
// are the same bytes — a report a reviewer can diff beats a report
// that needs a browser.
//
// Eight sections in the plan's order, refusals first, and the three
// absence vocabularies pinned distinct: "withheld" is a gate that
// held numbers back with its reason, "unknown" is a page that could
// not find out, "not applicable" is a session shape with no such
// value — and none of them may ever render as a zero or an empty
// cell. The report judges the MEASUREMENT, never the person, and it
// renders ONLY after the camera stops: a participant who reads a
// report mid-session has learned what the instrument counts.

export type ReportValue =
  | { kind: "measured"; text: string }
  | { kind: "withheld"; reason: string }
  | { kind: "unknown" }
  | { kind: "notApplicable" };

export type ReportLine = {
  label: string;
  value: ReportValue;
};

export type ParticipantReportInputs = {
  verdict: SessionVerdict;
  /** Section 3's lines, except the score, which has its own shape. */
  measured: readonly ReportLine[];
  /** Null means withheld, and then the reason is mandatory prose. */
  score: ScoreBreakdown | null;
  scoreWithheldReason: string | null;
  /** Section 4's lines: camera, rates, frame, KSS, markers. */
  conditions: readonly ReportLine[];
  /** Truncation declarations, verbatim as the file carries them. */
  truncations: readonly string[];
  storedProbe: StorageProbe;
  appCommit: string | null;
  /** Pre-formatted on-device time; the report never reads a clock. */
  generatedAt: string;
};

/** The one rendering of an absent value, everywhere. */
export function renderReportValue(value: ReportValue): string {
  switch (value.kind) {
    case "measured":
      return value.text;
    case "withheld":
      return `withheld — ${value.reason}`;
    case "unknown":
      return "unknown";
    case "notApplicable":
      return "not applicable";
  }
}

/**
 * Whether the report may render: only after the camera stopped, and
 * only when something was recorded. A failed session with records
 * still gets its report — refusals lead, and a failure is a result —
 * but a running one never does, because a participant who watches
 * the report mid-session has learned what the instrument counts.
 */
export function reportAvailable(
  stateKind: CameraState["kind"],
  recordCount: number,
): boolean {
  if (
    stateKind === "running" ||
    stateKind === "requesting" ||
    stateKind === "loadingClip"
  ) {
    return false;
  }
  return recordCount > 0;
}

// The model card's own words; any mention of the score travels with
// them, in section 1 and again beside the score itself.
const UNVALIDATED_SCORE_SENTENCE =
  "The alertness score is an unvalidated heuristic: it has never " +
  "been shown to correspond to how sleepy anyone actually is.";

// Refusals first: the order a reader must see bad news in. Ok goes
// last because good news can wait, and notApplicable sits between —
// a surface the session shape does not have is still worth naming
// before the ones that passed.
const SECTION_2_ORDER: readonly SurfaceStatus[] = [
  "refused",
  "warned",
  "unknown",
  "notApplicable",
  "ok",
];

function statusWord(status: SurfaceStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "refused":
      return "REFUSED";
    case "warned":
      return "WARNED";
    case "unknown":
      return "UNKNOWN";
    case "notApplicable":
      return "NOT APPLICABLE";
  }
}

function lines(rows: readonly ReportLine[]): string[] {
  return rows.map((row) => `${row.label}: ${renderReportValue(row.value)}`);
}

function sectionOne(): string[] {
  return [
    "1. WHAT THIS IS",
    "",
    demoNoticeText(),
    "",
    "This report belongs to a research pilot session, run with your " +
      "consent to test the instrument, not you. " +
      UNVALIDATED_SCORE_SENTENCE,
  ];
}

function sectionTwo(verdict: SessionVerdict): string[] {
  const rows: string[] = [
    "2. WAS THIS MEASUREMENT SOUND?",
    "",
    `Headline: ${statusWord(verdict.headline)}.`,
    "",
  ];
  for (const status of SECTION_2_ORDER) {
    for (const finding of verdict.surfaces) {
      if (finding.status !== status) {
        continue;
      }
      if (finding.surface === "calibration" && status === "refused") {
        // The plan's framing sentence, then the pinned sentence
        // itself — the report may not paraphrase a refusal.
        rows.push("A refused calibration is a result, not a failure.");
      }
      rows.push(
        `${statusWord(status)} — ${finding.surface}: ${finding.sentence}`,
      );
    }
  }
  return rows;
}

function sectionThree(inputs: ParticipantReportInputs): string[] {
  const rows = ["3. WHAT WAS MEASURED", "", ...lines(inputs.measured), ""];
  if (inputs.score === null) {
    rows.push(
      `Alertness score: ${renderReportValue({
        kind: "withheld",
        reason:
          inputs.scoreWithheldReason ??
          "no reason was recorded, which is itself a defect worth reporting",
      })}`,
    );
  } else {
    rows.push(`Alertness score: ${String(inputs.score.score)} of 100.`);
    rows.push("The working — 100 minus the named penalties:");
    for (const contribution of inputs.score.contributions) {
      rows.push(
        contribution.available
          ? `  ${contribution.name}: -${String(contribution.points)} ` +
              `point${contribution.points === 1 ? "" : "s"}`
          : `  ${contribution.name}: unavailable — absence is not ` +
              `scored as alertness`,
      );
    }
  }
  rows.push(UNVALIDATED_SCORE_SENTENCE);
  return rows;
}

function sectionFive(inputs: ParticipantReportInputs): string[] {
  const rows = [
    "5. WHAT WAS WITHHELD, REFUSED, OR TRUNCATED",
    "",
    "Every surface, and what it decided:",
    ...inputs.verdict.surfaces.map(
      (finding) => `  ${finding.surface}: ${statusWord(finding.status)}`,
    ),
  ];
  const withheld = inputs.measured.filter(
    (row) => row.value.kind === "withheld",
  );
  if (withheld.length > 0) {
    rows.push("", "Withheld values, each with its reason:");
    rows.push(...lines(withheld).map((row) => `  ${row}`));
  }
  if (inputs.truncations.length > 0) {
    rows.push(
      "",
      "Truncations, declared here exactly as the file declares them:",
    );
    rows.push(...inputs.truncations.map((entry) => `  ${entry}`));
  }
  if (withheld.length === 0 && inputs.truncations.length === 0) {
    rows.push("", "No measured value was withheld and nothing was truncated.");
  }
  return rows;
}

function sectionSix(): string[] {
  return [
    "6. WHAT THIS INSTRUMENT CANNOT SEE",
    "",
    ...CANNOT_SEE_CLAIMS.flatMap((entry) => [
      `- ${entry.claim}`,
      `  (${entry.source})`,
    ]),
  ];
}

function sectionSeven(probe: StorageProbe): string[] {
  return [
    "7. YOUR DATA AND YOUR CONTROL",
    "",
    "Nothing you recorded left this device. The exports exist only " +
      "where you saved them, and only you can send them anywhere.",
    "",
    storedSummary(probe),
    ...STORED_ITEMS.map((item) => `- ${item.what} (${item.why}).`),
    "The erase control on the page deletes the stored items above.",
  ];
}

function sectionEight(inputs: ParticipantReportInputs): string[] {
  return [
    "8. PROVENANCE",
    "",
    `Protocol: ${PROTOCOL_ID}`,
    `App commit: ${inputs.appCommit ?? "unknown"}`,
    `Generated on this device: ${inputs.generatedAt}`,
  ];
}

/** The whole report, one string, panel and file alike. */
export function buildParticipantReport(
  inputs: ParticipantReportInputs,
): string {
  const divider = "";
  return [
    "BLINKLAB PARTICIPANT REPORT",
    divider,
    ...sectionOne(),
    divider,
    ...sectionTwo(inputs.verdict),
    divider,
    ...sectionThree(inputs),
    divider,
    "4. CONDITIONS",
    "",
    ...lines(inputs.conditions),
    divider,
    ...sectionFive(inputs),
    divider,
    ...sectionSix(),
    divider,
    ...sectionSeven(inputs.storedProbe),
    divider,
    ...sectionEight(inputs),
    divider,
  ].join("\n");
}
