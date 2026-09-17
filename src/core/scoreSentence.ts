// The score readout's one sentence, extracted from the wiring for
// roadmap 14.2: the podium big view and the Alertness card must
// share the IDENTICAL formatted string for a null, and two copies of
// a sentence kept identical by attention is the exact defect the
// verdict fixtures retired (10.1f5). So the sentence lives here,
// both surfaces call it, and the clause holds by construction.
//
// The branch order is the honesty order. A refused calibration
// outranks everything: a refused session has no ruler, so even a
// computed-looking number would be a costume. A missing score with
// no face names the empty chair rather than scoring it — the same
// adversarial finding score.ts records, an empty seat asserting
// maximum drowsiness about a chair. And a null is never a zero: no
// digit appears in any refusal sentence, which is what lets a test
// pin "never renders 0" as a property rather than a hope.

export type ScoreSentenceInputs = {
  calibrationRefused: boolean;
  /** The scorer's verdict, or null where scoreRecords refused. */
  score: number | null;
  /** The newest record's faceDetected, or undefined before any row. */
  faceDetected: boolean | undefined;
};

export function scoreSentence(inputs: ScoreSentenceInputs): string {
  if (inputs.calibrationRefused) {
    return "Alertness score: withheld, calibration was refused";
  }
  if (inputs.score !== null) {
    return `Alertness score: ${String(inputs.score)} / 100`;
  }
  if (inputs.faceDetected === false) {
    return "Alertness score: no face in frame";
  }
  return "Alertness score: measuring...";
}
