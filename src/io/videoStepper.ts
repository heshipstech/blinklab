import type { VideoWithFrameCallback } from "./frameLoop";

// Stepping a clip, rather than watching it.
//
// Watching measures a clip at whatever rate the model manages on that
// machine, so the same file yields different data on different
// hardware. For a benchmark that is fatal: a result that depends on the
// reviewer's laptop is not a result.
//
// The first version of this file played the clip and paused inside the
// frame callback, on the theory that pausing synchronously would stop
// it before the next frame presented. IT DOES NOT. A playing video
// advances in real time no matter what the measuring code is doing, and
// at 60 frames per second a frame arrives every 17 milliseconds, which
// is shorter than the gap between resuming playback and the pause
// taking effect. The owner's first real recording proved it: a constant
// 60 fps clip of 12,626 frames was measured as 6,655, and the app
// cheerfully reported "measured every frame". Worse, the shortfall
// tracked how busy the machine was, which is exactly the dependence
// this file exists to remove.
//
// So the clip is never played. Each frame is SOUGHT. Seeking is slower
// and it does not care what else the computer is doing.

export type SteppedFrame = {
  mediaTimeSeconds: number;
  index: number;
};

export type StepSummary = {
  framesMeasured: number;
  lastMediaTimeSeconds: number | null;
  frameIntervalSeconds: number | null;
  stoppedEarly: boolean;
};

// A seek that lands on the frame already showing produces no new frame
// callback. Rather than hang, give up on a frame after this long and
// nudge the target forward.
const SEEK_TIMEOUT_MS = 2000;

// Sampled to learn the clip's frame interval before stepping begins.
const CALIBRATION_FRAMES = 6;

// How many seeks calibration may spend finding those frames. Generous
// on purpose: a probe that lands on the frame already showing costs an
// attempt and teaches nothing, and at a 10 ms step it takes three or
// four of them to cross one frame of a 30 fps clip.
const CALIBRATION_ATTEMPTS = 60;

// How far each probe moves. Under half a frame even at 60 fps, so it
// cannot step over one, but four times the old 4 ms so the budget
// actually reaches several distinct frames.
const CALIBRATION_STEP_S = 0.01;

// How long to let the frame callback answer after `seeked` has
// already fired, before settling for the less precise reading.
// Measured in WebKit: the frame callback answered a paused seek
// between 17 and 66 ms after `seeked`. A 60 ms grace clipped the slow
// end and let the imprecise reading win, which is how a 60 frame clip
// came to be measured as 180.
const FRAME_GRACE_MS = 200;

// Seeking, and finding out where we landed.
//
// Two signals can tell us a seek finished, and browsers disagree about
// which arrives. requestVideoFrameCallback carries the frame's true
// media time, which is what we want. The `seeked` event carries no
// frame information but is more reliably delivered on a paused video.
// So both are awaited and the better answer is preferred, rather than
// depending on one and hanging when it does not come.
type SeekLanding = {
  mediaTimeSeconds: number;
  exact: boolean;
};

function seekTo(
  video: VideoWithFrameCallback,
  timeSeconds: number,
  timeoutMs = SEEK_TIMEOUT_MS,
): Promise<SeekLanding | null> {
  return new Promise((resolve) => {
    let settled = false;
    let seekedFired = false;

    function finish(landing: SeekLanding | null): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve(landing);
    }

    // A little grace after `seeked` so the frame callback, which knows
    // the true media time, gets a chance to win before falling back to
    // currentTime, which only reports where we aimed.
    function onSeeked(): void {
      seekedFired = true;
      setTimeout(() => {
        finish({ mediaTimeSeconds: video.currentTime, exact: false });
      }, FRAME_GRACE_MS);
    }

    const timer = setTimeout(() => {
      finish(
        seekedFired
          ? { mediaTimeSeconds: video.currentTime, exact: false }
          : null,
      );
    }, timeoutMs);

    video.addEventListener("seeked", onSeeked);
    video.requestVideoFrameCallback((_nowMs, metadata) => {
      finish({ mediaTimeSeconds: metadata.mediaTime, exact: true });
    });
    video.currentTime = timeSeconds;
  });
}

/**
 * Learn the clip's frame interval by sampling its first few frames.
 *
 * Read from the frames themselves rather than from a container header,
 * because a header states an intention and this needs what the decoder
 * actually produces. Returns null when the clip is too short or the
 * samples disagree, and the caller then falls back to a nominal rate.
 */
/**
 * Where the clip's timeline actually begins.
 *
 * Not always zero. A file remuxed from another container can carry a
 * start offset: one corpus clip here begins at 1.633 seconds, and
 * seeking to zero on it lands before the video exists. Every frame
 * request then fails, calibration reports an unknown rate, and the run
 * burns its budget on empty time before giving up. `seekable` is the
 * browser's own answer to "what can I ask for".
 */
function timelineStart(video: VideoWithFrameCallback): number {
  if (video.seekable.length === 0) return 0;
  const start = video.seekable.start(0);
  return Number.isFinite(start) ? start : 0;
}

function timelineEnd(video: VideoWithFrameCallback): number | null {
  if (video.seekable.length > 0) {
    const end = video.seekable.end(video.seekable.length - 1);
    if (Number.isFinite(end)) return end;
  }
  return Number.isFinite(video.duration) ? video.duration : null;
}

async function measureFrameInterval(
  video: VideoWithFrameCallback,
): Promise<number | null> {
  const times: number[] = [];
  let probe = timelineStart(video);
  for (let attempt = 0; attempt < CALIBRATION_ATTEMPTS; attempt += 1) {
    const landing = await seekTo(video, probe);
    if (landing === null) break;
    // Only a frame callback knows where we actually landed. An
    // imprecise reading returns the time we ASKED for, so measuring
    // gaps between those would measure this loop's own nudge size
    // rather than the clip's frame interval. That is exactly how a 60
    // frame clip was once measured as 180.
    if (!landing.exact) {
      probe += CALIBRATION_STEP_S;
      continue;
    }
    const mediaTime = landing.mediaTimeSeconds;
    const newest = times.at(-1);
    if (newest === undefined || mediaTime > newest) {
      times.push(mediaTime);
    }
    if (times.length >= CALIBRATION_FRAMES) break;
    // Nudge forward from whichever is later, the probe or the frame it
    // landed on. Advancing from mediaTime alone deadlocks: a seek into
    // the middle of frame zero returns mediaTime zero, so the next
    // probe is computed from zero again and the loop asks for the same
    // instant until it gives up. That is why the first real clip
    // reported "unknown rate". 4 ms is under half a frame even at 120
    // frames per second, so this cannot step over one.
    probe = Math.max(probe, mediaTime) + CALIBRATION_STEP_S;
  }

  if (times.length < 2) return null;

  const gaps: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const later = times[index];
    const earlier = times[index - 1];
    if (later === undefined || earlier === undefined) continue;
    gaps.push(later - earlier);
  }
  if (gaps.length === 0) return null;
  // The SMALLEST gap, not the median or the average, and the reasoning
  // matters. Frame times are quantised, so every observed gap is a
  // whole number of frame intervals. Probing can accidentally step over
  // a frame and see two intervals; it can never see less than one. So
  // the minimum is the interval and anything larger is a skip.
  //
  // The median was wrong and WebKit on a Linux runner proved it: half
  // the probes skipped a frame there, the median came out about 2.2
  // times too large, and a 60 frame clip was measured as 27.
  const smallest = Math.min(...gaps);
  // A clip claiming frames a microsecond or ten seconds apart is not
  // something to build a seek schedule on.
  if (!Number.isFinite(smallest) || smallest <= 0.001 || smallest > 1) {
    return null;
  }
  return smallest;
}

/**
 * Walk a clip one frame at a time by seeking, never by playing.
 *
 * `shouldStop` is checked between frames so a long clip can be
 * abandoned without waiting for it to finish.
 */
export async function stepThroughVideo(
  video: VideoWithFrameCallback,
  onFrame: (frame: SteppedFrame) => void | Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<StepSummary> {
  video.pause();

  const interval = await measureFrameInterval(video);
  // REFUSED rather than guessed, and this is the whole lesson of the
  // first corpus run. The old fallback assumed 60 frames per second
  // when calibration failed. On a 30 fps clip that halves the step, so
  // every frame is visited twice: a 15,784 frame recording reported
  // 31,568 measurements, every timestamp was double, and the file
  // looked entirely normal. A wrong number that looks right is worse
  // than no number.
  if (interval === null) {
    return {
      framesMeasured: 0,
      lastMediaTimeSeconds: null,
      frameIntervalSeconds: null,
      stoppedEarly: true,
    };
  }
  const step = interval;

  // Where this clip's timeline begins, which is not always zero.
  const origin = timelineStart(video);

  let index = 0;
  let lastMediaTimeSeconds: number | null = null;
  // The end is re-read on every frame rather than captured once. A
  // browser can report a short duration while a clip is still buffering
  // and revise it upward later, and freezing that early guess into the
  // stop condition once cut a run off at 27 frames of 60.

  // Driven by frame INDEX, not by whatever time a seek reports landing
  // on. Every browser can be asked for frame k; not every browser will
  // say precisely where it landed. Computing the target from the index
  // gives exactly one measurement per frame either way, and removes a
  // whole class of drift where the schedule is derived from its own
  // previous answer.
  for (;;) {
    if (shouldStop()) {
      return {
        framesMeasured: index,
        lastMediaTimeSeconds,
        frameIntervalSeconds: interval,
        stoppedEarly: true,
      };
    }

    // The middle of frame `index`'s window, measured from where the
    // clip's timeline actually starts. Aiming at an edge is what makes
    // a seek ambiguous between two frames.
    const target = origin + (index + 0.5) * step;
    const end = timelineEnd(video);
    if (end !== null && target > end) break;

    const landing = await seekTo(video, target);
    if (landing === null) break;

    // Prefer the frame's own time; fall back to the schedule, which is
    // correct for constant frame rate video and honest for the rest.
    const mediaTimeSeconds = landing.exact
      ? landing.mediaTimeSeconds
      : index * step;

    // The last frame, twice. Near the end of a clip the schedule can
    // aim at a target that is still inside the duration but lands on
    // the final frame again, and counting it a second time makes the
    // instrument claim more frames than the file contains. Safari did
    // this on a real 4,202 frame recording and reported 4,203.
    //
    // Only checked when the landing is exact, because an inexact
    // landing reports the target rather than the frame and would stop
    // the run at the first repeat that was not one.
    if (
      landing.exact &&
      lastMediaTimeSeconds !== null &&
      mediaTimeSeconds <= lastMediaTimeSeconds
    ) {
      break;
    }

    await onFrame({ mediaTimeSeconds, index });
    lastMediaTimeSeconds = mediaTimeSeconds;
    index += 1;
  }

  return {
    framesMeasured: index,
    lastMediaTimeSeconds,
    frameIntervalSeconds: interval,
    stoppedEarly: false,
  };
}
