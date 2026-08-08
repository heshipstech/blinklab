// Which clock drives the pipeline, and which frames are new.
//
// Everything downstream of the frame loop reads one number: the
// timestamp of the frame being processed. Live from a camera, that is
// the wall clock, and the wall clock is right because the camera and
// the room share it.
//
// A video file does not share it. The file has its own time axis, and
// the two only agree while the clip happens to play at exactly one
// times speed with nothing dropped. Process a ten minute clip in
// thirty seconds, which is what a batch runner exists to do, and every
// timestamp would span thirty seconds instead of ten minutes: blink
// rate would read twenty times too fast, durations twenty times too
// short, and PERCLOS would average over the wrong window. So a file is
// timed by its own currentTime, never by the wall.
//
// The second job is duplicates. The frame loop ticks at display rate,
// around sixty times a second, and a thirty frame per second clip
// therefore offers the same decoded frame twice. Processing it twice
// would double-count it in every rolling window, and MediaPipe's
// detectForVideo requires strictly increasing timestamps anyway. A
// frame is new only when the clock has moved forward.

export type FrameClockState = {
  lastAcceptedMs: number | null;
};

export function startFrameClock(): FrameClockState {
  return { lastAcceptedMs: null };
}

export type FrameClockStep = {
  state: FrameClockState;
  accepted: boolean;
};

/**
 * Decide whether a candidate timestamp is a new frame.
 *
 * The first finite timestamp is always new. After that a timestamp is
 * new only if it is strictly greater than the last accepted one, which
 * rejects both the repeated frame and the backwards jump a seek
 * produces. A non-finite candidate is never new: there is no sane
 * ordering for NaN, and letting one through would poison every
 * comparison after it.
 */
export function acceptFrame(
  state: FrameClockState,
  candidateMs: number,
): FrameClockStep {
  if (!Number.isFinite(candidateMs)) {
    return { state, accepted: false };
  }
  if (state.lastAcceptedMs !== null && candidateMs <= state.lastAcceptedMs) {
    return { state, accepted: false };
  }
  return { state: { lastAcceptedMs: candidateMs }, accepted: true };
}

export type FrameSource = "camera" | "file";

/**
 * The timestamp a frame should carry, given where it came from.
 *
 * Camera frames carry the wall clock the frame loop supplies. File
 * frames carry the media's own position, converted from seconds to
 * milliseconds so both sources speak the same unit downstream.
 */
export function frameTimestampMs(
  source: FrameSource,
  wallClockMs: number,
  mediaTimeSeconds: number,
): number {
  return source === "camera" ? wallClockMs : mediaTimeSeconds * 1000;
}

/**
 * The metadata rows recording where a session's frames came from.
 *
 * An exported CSV is read months later by a person or a script that
 * cannot see the screen it came from. "These numbers are a live
 * webcam" and "these numbers are clip 06/5.mp4" are different claims,
 * and an analysis that cannot tell them apart will eventually average
 * across both.
 *
 * A clip name is written verbatim, including any newline someone put
 * in a filename, so the comment prefix is repeated on every line. A
 * bare newline here would end the comment and inject a data row.
 */
export function sourceMetadataRows(
  source: FrameSource,
  clipName: string | null,
): string[] {
  const safeName = (clipName ?? "").replace(/\r?\n/g, " ");
  return [
    `# source: ${source}`,
    `# clip: ${source === "file" && safeName !== "" ? safeName : "none"}`,
  ];
}
