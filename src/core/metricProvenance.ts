// Roadmap 14.3. Every number this page renders has a standing in the
// record — measured against a committed result, defined by a rule
// fixed in advance, unvalidated, or plain bookkeeping — and until this
// row that standing lived in docs/ where no visitor reading the number
// could see it. This table is the single source the explain-this-number
// popovers speak from, one entry per rendered readout.
//
// Two disciplines keep it honest. The keys are held to the page's own
// metric registry (core/idleStrings.ts) in both directions by the test
// next door, so a new readout cannot ship without naming its standing
// and a retired readout cannot leave a fossil here. And every document
// a status cites is held to the disk by tools/provenanceGuard.mjs, so
// a status cannot lean on a result file that does not exist.
//
// The sentences cite paths inline (docs/...) and the page turns each
// citation into a link pinned to the build's own commit, through
// core/docCitations.ts — the same apparatus row 14.0f2 built. Numbers
// are quoted sparingly: the AUC the roadmap row itself names, and
// nothing whose home document is still being re-measured.

/**
 * The record's taxonomy, whole. A status must be one of these; there
 * is deliberately no "validated" — nothing in this record earns that
 * word per person, and a taxonomy with an empty best category would
 * invite the page to grow into it silently.
 */
export type ProvenanceKind =
  "measured" | "convention" | "unvalidated" | "bookkeeping";

export interface MetricProvenance {
  kind: ProvenanceKind;
  /** One to three whole sentences, citing docs/ paths inline. */
  status: string;
}

/** The opening sentence each kind contributes to its popover. */
export function kindSentence(kind: ProvenanceKind): string {
  switch (kind) {
    case "measured":
      return "Measured: a committed result file backs this number.";
    case "convention":
      return (
        "Convention: a rule this instrument fixed in advance; " +
        "no outside comparability is claimed."
      );
    case "unvalidated":
      return "Unvalidated: No ground truth for this exists in the record.";
    case "bookkeeping":
      return "Bookkeeping: the instrument counting its own work.";
  }
}

export const METRIC_PROVENANCE: Readonly<Record<string, MetricProvenance>> = {
  "Alertness score": {
    kind: "measured",
    status:
      "Cohort-level evidence only: this hand-tuned score separates " +
      "self-reported alert from drowsy across strangers at AUC 0.70 " +
      "(docs/alertness-score-result.txt). It is unvalidated per person.",
  },
  "Eye aspect ratio": {
    kind: "convention",
    status:
      "A unitless per-frame geometry from the landmark model, with no " +
      "ground truth of its own here. The blink detector it feeds is " +
      "scored against annotated clips in docs/eyeblink8-result.txt.",
  },
  "Eyelid aperture": {
    kind: "measured",
    status:
      "Millimetres via the iris ruler, so every figure inherits the " +
      "11.7 mm iris assumption. The jitter to expect at rest is " +
      "measured in docs/aperture-noise-floor.txt.",
  },
  "Pupil diameter": {
    kind: "measured",
    status:
      "A webcam estimate on the same iris ruler. It detected the light " +
      "reflex in one recorded session (docs/pupil-light-result.txt), " +
      "and its floor in iris pixels is measured in " +
      "docs/pupil-resolution-floor.txt.",
  },
  "Aperture stability": {
    kind: "measured",
    status:
      "The aperture's coefficient of variation over 10 s, in pixels " +
      "and in millimetres. What ordinary rest looks like on this " +
      "instrument is measured in docs/aperture-noise-floor.txt.",
  },
  "PERCLOS (eyes closed share, last 60 s)": {
    kind: "convention",
    status:
      "An instrument-adjusted convention: the shut line is this " +
      "instrument's own personal threshold and the share includes " +
      "blink time, so it is not comparable to published PERCLOS. Its " +
      "sampling error is bounded in docs/sampling-bounds.txt.",
  },
  "Long closures": {
    kind: "convention",
    status:
      "Counted under an arming hysteresis whose rule was committed " +
      "before the code changed, in docs/long-closure-hysteresis.txt.",
  },
  "Iris offset": {
    kind: "unvalidated",
    status:
      "The raw iris-centre offset, unitless and uncalibrated. Nothing " +
      "in the record scores it against a real gaze target.",
  },
  "Looking toward": {
    kind: "convention",
    status:
      "Named through the nine-dot calibration, admitted only when the " +
      "fit passes bounds committed in advance in " +
      "docs/calibration-refusal.txt. No external ground truth judges " +
      "the naming.",
  },
  "Gaze state": {
    kind: "convention",
    status:
      "Fixation and saccade are split by a dispersion rule (I-DT), " +
      "never validated against an eye tracker, and conditioned on the " +
      "delivered frame rate every export carries.",
  },
  "Fixations in the last 10 s": {
    kind: "convention",
    status:
      "Counted by the same dispersion rule as the gaze state, so the " +
      "count is conditioned on the delivered frame rate every export " +
      "carries.",
  },
  "Head pose": {
    kind: "measured",
    status:
      "Angles from the face model's transform. They gate other numbers " +
      "because aperture measurably varies with pose: " +
      "docs/pose-aperture-bias.txt.",
  },
  Blinks: {
    kind: "measured",
    status:
      "Scored against annotated clips in docs/eyeblink8-result.txt. At " +
      "low sampled rates the count is a floor, measured in " +
      "docs/blink-sample-rate.txt.",
  },
  "Personal blink threshold": {
    kind: "convention",
    status:
      "Learned from the guided blink calibration and adopted under a " +
      "rule committed before the change, in docs/blink-line-adoption.txt.",
  },
  "Ruler fit": {
    kind: "measured",
    status:
      "The frozen baseline over the session's running median aperture, " +
      "spoken while the session runs because rulers that failed this " +
      "check after the fact are on record in docs/validation-round.txt.",
  },
  "Feature records": {
    kind: "bookkeeping",
    status:
      "A count of the rows this session has kept for export, about one " +
      "per second. The instrument's own work, not a measurement.",
  },
};

/**
 * The entry for a rendered metric, or a throw for a label the table
 * has never heard of. A popover that silently renders nothing for an
 * unregistered metric is the drift this row exists to prevent, so the
 * miss is loud and names the rule.
 */
export function metricProvenance(label: string): MetricProvenance {
  const entry = METRIC_PROVENANCE[label];
  if (entry === undefined) {
    throw new Error(
      `no provenance entry for the metric "${label}" — every rendered ` +
        "readout must name its status in the record's taxonomy " +
        "(roadmap 14.3)",
    );
  }
  return entry;
}

/** The whole popover sentence: the kind's opening, then the status. */
export function provenanceText(label: string): string {
  const entry = metricProvenance(label);
  return `${kindSentence(entry.kind)} ${entry.status}`;
}
