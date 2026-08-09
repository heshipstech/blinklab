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

// How a clip was measured. A clip that was watched is measured at
// whatever rate the model managed on that machine; a clip that was
// stepped is measured completely. The difference decides whether a
// result is a property of the file or a property of the laptop, so it
// belongs in the file rather than in somebody's memory.
export type MeasurementMode = "live" | "played" | "stepped";

function humanDuration(seconds: number): string {
  if (seconds < 90) return `${String(Math.max(1, Math.round(seconds)))} s`;
  return `${String(Math.round(seconds / 60))} min`;
}

/**
 * What to say while a clip is being stepped.
 *
 * Stepping a three minute recording can take ten minutes or more, and
 * the first version of it said only "Measuring every frame..." for the
 * whole time. A progress line that never changes is indistinguishable
 * from a hang, and the owner said so within minutes of the first real
 * clip. A long wait is acceptable; a silent one is not.
 *
 * The estimate is deliberately withheld until a twentieth of the clip
 * is done. Before that the sample is tiny and the model's first
 * inference is far slower than the rest, so an early guess would be
 * wildly wrong and then visibly shrink, which reads as a broken
 * estimate rather than an improving one.
 */
export function steppingProgress(
  framesMeasured: number,
  mediaTimeSeconds: number,
  durationSeconds: number | null,
  elapsedMs: number,
): string {
  const counted = `Measuring every frame: ${String(framesMeasured)} done`;

  if (
    durationSeconds === null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isFinite(mediaTimeSeconds)
  ) {
    return `${counted}. This can take several minutes.`;
  }

  const fraction = Math.min(1, Math.max(0, mediaTimeSeconds / durationSeconds));
  const percent = Math.round(fraction * 100);

  if (fraction < 0.05 || elapsedMs <= 0) {
    return `${counted}, ${String(percent)}% of the clip.`;
  }

  const remainingSeconds = (elapsedMs / fraction - elapsedMs) / 1000;
  if (remainingSeconds < 1) {
    return `${counted}, ${String(percent)}% of the clip, almost there.`;
  }
  return `${counted}, ${String(percent)}% of the clip, about ${humanDuration(remainingSeconds)} left.`;
}

/**
 * The metadata rows recording how completely a session was measured.
 *
 * Without these, a CSV from a slow machine that saw one frame in
 * nineteen is indistinguishable from one that saw every frame. Both
 * look like honest per-second records, and averaging across them
 * silently mixes two different measurements.
 *
 * frames_measured is written for every mode, because "how many frames
 * did this instrument actually look at" is a fair question of a live
 * session too.
 */
export function coverageMetadataRows(
  mode: MeasurementMode,
  framesMeasured: number,
  durationSeconds: number | null,
): string[] {
  const duration =
    durationSeconds === null || !Number.isFinite(durationSeconds)
      ? "unknown"
      : durationSeconds.toFixed(3);
  const rate =
    durationSeconds !== null &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
      ? (framesMeasured / durationSeconds).toFixed(2)
      : "unknown";
  return [
    `# measurement_mode: ${mode}`,
    `# frames_measured: ${String(framesMeasured)}`,
    `# clip_duration_s: ${duration}`,
    `# measured_fps: ${rate}`,
  ];
}

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
 * Any line break in a filename is flattened to a space, because a
 * break would end the comment and the rest of the name would parse as
 * a data row. All three kinds are flattened, not only newline: a bare
 * carriage return is a line break to a CSV reader too, and this
 * project's own Python loader reads the file in universal newline
 * mode, where a lone \r ends the line exactly as \n does.
 */
export function sourceMetadataRows(
  source: FrameSource,
  clipName: string | null,
): string[] {
  const safeName = (clipName ?? "").replace(/\r\n|\r|\n/g, " ");
  return [
    `# source: ${source}`,
    `# clip: ${source === "file" && safeName !== "" ? safeName : "none"}`,
  ];
}

/**
 * Did the stepper visit frames it had already measured?
 *
 * Two counts exist for one run. The stepper counts frames it SOUGHT TO.
 * The pipeline counts frames it actually MEASURED, after this module's
 * clock rejected repeats. In a healthy run they are the same number.
 *
 * When they are not, the calibrated step interval is smaller than the
 * clip's true frame period, so the stepper lands on the same decoded
 * frame more than once. That is not noise, it is the interval being
 * wrong, and it means the RATE derived from that interval is wrong too.
 *
 * Measured on DROZY, 10 August 2026: a 15 frames per second recording
 * stepped at a 30 fps interval sought 3600 frames and measured 1800,
 * and the status line reported "3600 frames at 30.0 frames per second"
 * because it printed the stepper's count and the calibrated rate. The
 * exported file was correct throughout. Only the operator was misled,
 * and that is what masked issue #192 for an hour. See #193.
 *
 * The tolerance is deliberately tight. A seek landing on the frame
 * already showing is possible but rare once calibration has succeeded,
 * so anything worse than a couple of frames in a hundred is the
 * interval being wrong rather than luck.
 */
export const STEPPING_DUPLICATE_TOLERANCE = 0.98;

export type SteppingCheck =
  | { kind: "ok" }
  | {
      kind: "duplicateVisits";
      sought: number;
      measured: number;
      // What the frame rate really was, given how many frames were
      // measured over the clip's own duration. This is the number to
      // trust, not the one derived from the calibrated interval.
      trueRate: number | null;
    };

export function checkStepping(
  sought: number,
  measured: number,
  durationSeconds: number | null,
): SteppingCheck {
  if (sought <= 0 || measured >= sought * STEPPING_DUPLICATE_TOLERANCE) {
    return { kind: "ok" };
  }
  const trueRate =
    durationSeconds !== null &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
      ? measured / durationSeconds
      : null;
  return { kind: "duplicateVisits", sought, measured, trueRate };
}

/** What to tell the operator when the stepper visited frames twice. */
export function steppingWarning(check: SteppingCheck): string {
  if (check.kind === "ok") return "";
  const rate =
    check.trueRate === null
      ? "unknown"
      : `${check.trueRate.toFixed(1)} frames per second`;
  return (
    `This clip was stepped at the wrong interval. ` +
    `${String(check.sought)} frames were sought but only ` +
    `${String(check.measured)} were new, so the rest were the same frame ` +
    `visited twice. The clip's real rate is ${rate}. ` +
    `The exported file records the measured count and is correct.`
  );
}
