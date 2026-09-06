// The per-frame trace: docs/miss-trace.txt, the tool the miss
// investigation needs first.
//
// The miss-identity result left a fixed target — 46 blinks missed
// under two ruler regimes, seventy percent containing a frame a human
// marked fully closed — and no export could say what the aperture did
// during them, because a clip's export carries one row per second
// while a seven-frame blink lives entirely between two rows. This
// module records one row per measured clip frame, joined to the
// corpus ground truth by frame number, carrying the aperture the
// instrument read and the line the detector actually compared
// against. Clips only: a camera session never buffers frames, because
// hours of per-frame face data is a different memory and privacy
// surface, and nothing in the miss investigation needs it.

/** One measured frame of a clip. */
export type FrameTraceRow = {
  /** The frame the stepper aimed at — the annotators' numbering. */
  frameIndex: number;
  /** The clip's own clock at that frame. */
  mediaTimeSeconds: number;
  /** What the instrument read, or null when no trusted face was. */
  apertureMm: number | null;
  /**
   * The EFFECTIVE line the detector compared against on this frame:
   * the personal threshold once the ruler is ready, the generic
   * constant before it, null when the detector was fed nothing.
   * Recorded rather than reconstructed, because "did it dip below
   * the line" is the whole question and a reconstructed line is a
   * guess where this one is a fact.
   */
  blinkLineMm: number | null;
  /**
   * The iris aspect ratio (aperture.ts's irisAspectRatio), a closure
   * witness read from the iris rim and INDEPENDENT of apertureMm:
   * near 1 on an open iris, falling as a lid hides the top rim — if
   * the model tracks the occluded rim. Recorded so the miss autopsy
   * can ask, on frames where the aperture did not dip, whether a
   * second signal saw the closure. Null when no trusted iris was
   * measured. Prediction: docs/iris-occlusion.txt.
   */
  irisAspectRatio: number | null;
};

/**
 * Following BLINK_LOG_RECORD_CAP's precedent rather than inventing a
 * second convention: 20,000 frames, above the longest Eyeblink8
 * clip's 15,784, so it never binds on the corpus this exists for.
 */
export const FRAME_TRACE_RECORD_CAP = 20000;

/**
 * Append a frame, keeping the PREFIX when the cap binds.
 *
 * The blink log drops its oldest entry, which is right for a live
 * session where the recent past matters most. This trace exists to be
 * joined to ground truth BY FRAME NUMBER, and a file whose first
 * recorded frame silently moves breaks every join anchored at the
 * front. So the trace stops appending instead: the prefix stays
 * intact, and serialisation declares what fell off the end.
 */
export function appendFrameTraceRow(
  rows: readonly FrameTraceRow[],
  row: FrameTraceRow,
): FrameTraceRow[] {
  if (rows.length >= FRAME_TRACE_RECORD_CAP) {
    return [...rows];
  }
  return [...rows, row];
}

const FRAME_TRACE_COLUMNS = [
  "frameIndex",
  "mediaTimeSeconds",
  "apertureMm",
  "blinkLineMm",
  "irisAspectRatio",
];

function cell(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Serialise the trace, one row per measured frame.
 *
 * Returns null when there are no rows, rather than a lone header: a
 * header with no rows claims a measurement in which frames were
 * traced and none arrived, which is a different fact from no trace at
 * all — the blink log's refusal, for the same reason.
 *
 * `framesMeasured` is the measurement's own count. When it is larger
 * than the rows here, later frames fell off the capped end, and the
 * file says so on its own face — the declaration convention the blink
 * log established after a silent cap cost a day of misreading.
 */
export function serialiseFrameTrace(
  rows: readonly FrameTraceRow[],
  metadataRows: readonly string[] = [],
  framesMeasured?: number,
): string | null {
  if (rows.length === 0) return null;
  // Roadmap 10.16, ladder A27. This used to write its own
  // `# frames_measured` row beside the warning, while the caller
  // already passes coverageMetadataRows, which writes that key for
  // every mode. Two rows with the same key is exactly what loader.py
  // refuses as "edited or damaged", so a TRUNCATED trace — the one
  // case this warning exists for — was the one file the Python side
  // would not read. The warning keeps the number in its own sentence
  // and stops declaring a key somebody else owns.
  const lostRows =
    framesMeasured !== undefined && framesMeasured > rows.length
      ? [
          `# WARNING: ${String(framesMeasured - rows.length)} later frames were measured but are NOT in this file`,
          `# frames_recorded: ${String(rows.length)}`,
        ]
      : [];
  const lines = [...metadataRows, ...lostRows, FRAME_TRACE_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.frameIndex),
        cell(row.mediaTimeSeconds),
        cell(row.apertureMm),
        cell(row.blinkLineMm),
        cell(row.irisAspectRatio),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
