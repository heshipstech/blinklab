// When the once-per-second feature record may be written.
//
// The cadence used to be the animation clock alone: a row whenever a
// second had passed since the last. That is right for a clip, whose
// frame handler runs only on decoded frames, and for a browser that
// cannot report delivery at all. It is wrong for an observed camera
// that has frozen: the animation loop keeps ticking, the model keeps
// reading the same photograph, and a row a second went on describing
// an eye nobody was looking at (roadmap 14.0d, audit A26).
//
// Delivery is a necessary condition, never a sufficient one: a frame
// that arrived does not shorten the second.

export const RECORD_PERIOD_MS = 1000;

export type RecordGateInputs = {
  /** When the last row was written, on the record clock; null before the first. */
  lastRecordAtMs: number | null;
  nowMs: number;
  /** Whether a delivery callback is watching the source. */
  observed: boolean;
  /** Frames delivered since the session began. */
  deliveredCount: number;
  /** deliveredCount when the last row was written; 0 before the first. */
  deliveredCountAtLastRecord: number;
};

export function recordDue(inputs: RecordGateInputs): boolean {
  const secondPassed =
    inputs.lastRecordAtMs === null ||
    inputs.nowMs - inputs.lastRecordAtMs >= RECORD_PERIOD_MS;
  if (!secondPassed) {
    return false;
  }
  if (!inputs.observed) {
    return true;
  }
  return inputs.deliveredCount > inputs.deliveredCountAtLastRecord;
}
