import type { BlinkShape } from "./blinkShape";
import { BLINK_LOG_DISPLAY_CAP, BLINK_LOG_RECORD_CAP } from "./constants";
import { pushBounded } from "./ringBuffer";

// The durable record of Phase 4: each completed blink as an event,
// when it ended, how long it lasted, and what shape it had.
export type BlinkEvent = {
  atMs: number;
  durationMs: number;
  shape: BlinkShape | null;
  // Which frames the closure spanned. Null for a live camera, where
  // "frame 900" means nothing to anyone. For a clip they are the whole
  // point: a human annotator marks blinks BY FRAME NUMBER, so a
  // comparison against ground truth can only happen in those terms.
  // Milliseconds cannot substitute, because the annotator's clock and
  // ours agree only if the frame rate is exactly what both assumed.
  startFrame: number | null;
  endFrame: number | null;
};

export function appendEvent(
  events: readonly BlinkEvent[],
  event: BlinkEvent,
): BlinkEvent[] {
  return pushBounded(events, event, BLINK_LOG_RECORD_CAP);
}

/**
 * The slice the on screen list shows.
 *
 * Separate from the record on purpose. Trimming for the reader is a
 * display decision and belongs at the display, not in the thing being
 * recorded, and collapsing the two is the exact mistake that cost the
 * first external validation 63 rows across three clips, 54 of them real
 * blinks. The full account, with the numbers checked, is the blink log
 * comment in `constants.ts`.
 */
export function eventsForDisplay(
  events: readonly BlinkEvent[],
): readonly BlinkEvent[] {
  return events.length <= BLINK_LOG_DISPLAY_CAP
    ? events
    : events.slice(events.length - BLINK_LOG_DISPLAY_CAP);
}

/** The on-screen table's headers, units in the header rather than in
 * every cell. Repeating "ms" and "mm" on every row was most of the ink
 * in the old prose list and none of the information.
 */
export const BLINK_TABLE_HEADERS = [
  "When (s)",
  "Closed for (ms)",
  "Amplitude (mm)",
  "Speed (mm/s)",
  "A/V (ms)",
] as const;

/**
 * A blink whose amplitude is this small did not travel far enough to be
 * a blink, and the table greys it rather than hiding it: the export
 * keeps the row, so the panel must not disagree with the file. Chosen
 * from measured sessions where real blinks ran 2.2 to 6.9 mm and the
 * phantoms sat under 1 mm.
 */
export const FAINT_BLINK_MM = 1.5;

/** One row of the on-screen table, already formatted, newest first. */
export function blinkTableRow(
  event: BlinkEvent,
  sessionStartMs: number,
): { cells: string[]; faint: boolean } {
  const shape = event.shape;
  return {
    cells: [
      ((event.atMs - sessionStartMs) / 1000).toFixed(1),
      event.durationMs.toFixed(0),
      shape === null ? "—" : shape.amplitudeMm.toFixed(1),
      shape === null ? "—" : shape.peakClosingVelocityMmPerS.toFixed(0),
      shape === null ? "—" : shape.amplitudeOverVelocityMs.toFixed(0),
    ],
    faint: shape !== null && shape.amplitudeMm < FAINT_BLINK_MM,
  };
}

// The columns of the blink log export. Deliberately separate from the
// per-second FeatureRecord CSV, because a blink is an EVENT and a
// second is an interval, and squeezing events into a per-second table
// loses every blink after the first in any given second.
export const BLINK_CSV_COLUMNS = [
  "startFrame",
  "endFrame",
  "atMs",
  "durationMs",
  "amplitudeMm",
  "peakClosingVelocityMmPerS",
  "amplitudeOverVelocityMs",
] as const;

function cell(value: number | null | undefined): string {
  // Same rule as the per-second export: an empty field means NOT
  // MEASURED, never zero. A blink whose shape could not be analysed
  // must not read as a blink of zero amplitude.
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

/**
 * Serialise the blink log, one row per blink.
 *
 * Returns null when there are no blinks, rather than a lone header. A
 * header with no rows claims a session in which blinks were looked for
 * and none found, which is a different fact from no session at all,
 * and the per-second exporter makes the same refusal for the same
 * reason.
 *
 * `blinksDetected` is the detector's own count, which is not the same
 * number as the rows here and must not be assumed to be. When it is
 * larger, rows were lost, and the file says so on its own face. The
 * old export could not have said so, because it had no idea: a ring
 * buffer that drops its oldest entry leaves nothing behind to count.
 * That silence is why 69.6% was read as a detector's failure for a day
 * rather than as a truncated file, so the declaration is the actual
 * fix and the raised ceiling is only what makes it rare.
 */
export function serialiseBlinkEvents(
  events: readonly BlinkEvent[],
  metadataRows: readonly string[] = [],
  blinksDetected?: number,
): string | null {
  if (events.length === 0) return null;
  const lostRows =
    blinksDetected !== undefined && blinksDetected > events.length
      ? [
          `# WARNING: ${String(blinksDetected - events.length)} earlier blinks were detected but are NOT in this file`,
          `# blinks_detected: ${String(blinksDetected)}`,
          `# blinks_recorded: ${String(events.length)}`,
        ]
      : [];
  const lines = [...metadataRows, ...lostRows, BLINK_CSV_COLUMNS.join(",")];
  for (const event of events) {
    lines.push(
      [
        cell(event.startFrame),
        cell(event.endFrame),
        cell(event.atMs),
        cell(event.durationMs),
        cell(event.shape?.amplitudeMm),
        cell(event.shape?.peakClosingVelocityMmPerS),
        cell(event.shape?.amplitudeOverVelocityMs),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
