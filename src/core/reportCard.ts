import { demoNoticeText } from "./notice";
import {
  renderReportValue,
  scoreLine,
  statusWord,
  UNVALIDATED_SCORE_SENTENCE,
  type ParticipantReportInputs,
  type ReportLine,
} from "./participantReport";
import { PROTOCOL_ID } from "./sessionMetadata";
import type { SurfaceStatus } from "./sessionVerdict";

// The printable report card (roadmap 14.4): the text report's
// highlights, restructured for paper. The card owns nothing — the
// podium's rule, one surface later: every string it prints is a line
// buildParticipantReport already prints, rendered by the same
// functions, so the card cannot disagree with the report about a
// number, a refusal or a reason. The parity test holds each card
// line to the report verbatim, and the one sentence the report does
// not carry is the sentence saying what the card leaves out.

export type ReportCardLine = {
  label: string;
  /** Rendered through renderReportValue already: "withheld — reason",
   * "unknown", "not applicable" — never an empty string, never a
   * digit standing in for an absence. */
  value: string;
};

export type ReportCardModel = {
  title: string;
  /** The demo notice, which must PRINT (the row's third Check
   * clause): paper outlives the page that carried the banner, so the
   * caveat travels on the artifact itself. */
  notice: string;
  headline: string;
  /** Bad news makes the card: every refused, warned or unknown
   * surface, in the report's own refusals-first order and its own
   * words. A card whose headline hid a warned surface behind a
   * pointer would be the fine-print dishonesty the podium row
   * (14.2) exists to prevent. Empty when every surface passed. */
  flagged: readonly string[];
  measured: readonly ReportCardLine[];
  score: string;
  /** The model card's own words; any mention of the score travels
   * with them, on paper as on the page. */
  scoreCaveat: string;
  conditions: readonly ReportCardLine[];
  provenance: readonly ReportCardLine[];
  /** The one card-only sentence: what this card is not, so a page of
   * highlights cannot pass as the whole record. */
  omitted: string;
};

/** The statuses a reader must not learn about only from the full
 * report: refused and warned are the bad news, unknown is a page
 * that could not find out — which is also news. Ok and notApplicable
 * stay in the report, where every surface is listed. */
const CARD_FLAGGED: readonly SurfaceStatus[] = ["refused", "warned", "unknown"];

function rendered(rows: readonly ReportLine[]): ReportCardLine[] {
  return rows.map((row) => ({
    label: row.label,
    value: renderReportValue(row.value),
  }));
}

export function reportCardModel(
  inputs: ParticipantReportInputs,
): ReportCardModel {
  return {
    title: "BLINKLAB PARTICIPANT REPORT",
    notice: demoNoticeText(),
    headline: `Headline: ${statusWord(inputs.verdict.headline)}.`,
    flagged: CARD_FLAGGED.flatMap((status) =>
      inputs.verdict.surfaces
        .filter((finding) => finding.status === status)
        .map(
          (finding) =>
            `${statusWord(status)} — ${finding.surface}: ${finding.sentence}`,
        ),
    ),
    measured: rendered(inputs.measured),
    score: scoreLine(inputs.score, inputs.scoreWithheldReason),
    scoreCaveat: UNVALIDATED_SCORE_SENTENCE,
    conditions: rendered(inputs.conditions),
    provenance: [
      { label: "Protocol", value: PROTOCOL_ID },
      { label: "App commit", value: inputs.appCommit ?? "unknown" },
      { label: "Generated on this device", value: inputs.generatedAt },
    ],
    omitted:
      "This card is the report's highlights at paper size. The full " +
      "text report also carries: every surface's verdict in its own " +
      "sentence, the capability ladder, what was withheld or " +
      "truncated and why, what this instrument cannot see, and your " +
      "data and your control.",
  };
}
