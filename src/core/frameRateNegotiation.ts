// The frame-rate ask, as data (roadmap 13.2, brief C1).
//
// Every camera session in this project's record declares 30.0 frames
// per second, because the page has never ASKED for more: the request
// names a resolution and no rate at all, a fact
// docs/blink-sample-rate.txt has stated since August. The committed
// sampling model says delivery at 60 roughly doubles the odds of
// catching a minimal blink (0.48 to 0.96 at the 3.40 mm minimum), so
// the ask is worth making — and it is made as a MEASUREMENT, never an
// assumption: capabilities read, settings before, the ideal-60
// constraint, settings after, every step recorded in the export.
//
// The one hazard is the trade. The iris is this instrument's ruler
// and it runs on source pixels, so a camera that answers "60" by
// dropping from 1080p to 720p has moved the instrument's precision to
// buy its rate. That is allowed to happen — ideal constraints let the
// browser choose — but never allowed to happen SILENTLY, which is
// what resolutionChange() below exists to enforce and what the row's
// builder test pins.
//
// The io half (src/io/camera.ts) performs the reads and the ask; this
// module is the pure record of what happened, testable without a
// camera. The adoption condition — what the owner's device day may
// CLAIM from these numbers — was committed before any device is read,
// in docs/frame-rate-negotiation.txt.

/** What the ask asks for. `ideal`, never `exact`: a camera that
 * cannot comply returns what it can and nothing breaks. */
export const FRAME_RATE_ASK_FPS = 60;

/** One read of the track: rate and frame size, null where the
 * browser reported nothing, which is "unknown" and never "same". */
export type TrackReading = {
  frameRate: number | null;
  widthPx: number | null;
  heightPx: number | null;
};

export type FrameRateNegotiation = {
  /** capabilities.frameRate.max, or null where the browser keeps it
   * to itself. Recorded even when the ask fails, because "declared 60
   * and did not deliver" and "never claimed 60" are different facts. */
  declaredMaxFps: number | null;
  before: TrackReading;
  after: TrackReading;
  askedFps: number;
  /** applyConstraints threw. Recorded rather than thrown: a failed
   * ask leaves the default negotiation standing, which is a session
   * worth having, not a session to lose. */
  applyFailed: boolean;
};

function sizeOf(reading: TrackReading): string {
  return reading.widthPx === null || reading.heightPx === null
    ? "unknown"
    : `${reading.widthPx}x${reading.heightPx}`;
}

/**
 * The resolution the frame-rate step cost, or null when it held.
 *
 * Null ONLY when both sides are known and equal: an unreported side
 * reads "unknown" and the pair is surfaced, because "unknown" and
 * "unchanged" are different claims and upgrading one into the other
 * is exactly the silence this function exists to refuse.
 */
export function resolutionChange(
  negotiation: FrameRateNegotiation,
): { from: string; to: string } | null {
  const from = sizeOf(negotiation.before);
  const to = sizeOf(negotiation.after);
  return from === to && from !== "unknown" ? null : { from, to };
}

function cell(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

/**
 * The whole step as export rows, or nothing at all off the camera:
 * a clip has no track to negotiate with, so the step never ran and
 * absence is the honest record — the pseudonym rule, not six
 * unknowns.
 */
export function negotiationMetadataRows(
  negotiation: FrameRateNegotiation | null,
): string[] {
  if (negotiation === null) {
    return [];
  }
  const change = resolutionChange(negotiation);
  return [
    `# frame_rate_declared_max: ${cell(negotiation.declaredMaxFps)}`,
    `# frame_rate_asked: ${String(negotiation.askedFps)}`,
    `# frame_rate_before: ${cell(negotiation.before.frameRate)}`,
    `# frame_rate_after: ${cell(negotiation.after.frameRate)}`,
    `# frame_rate_apply: ${negotiation.applyFailed ? "failed" : "ok"}`,
    `# frame_rate_resolution_change: ${
      change === null ? "none" : `${change.from} -> ${change.to}`
    }`,
  ];
}
