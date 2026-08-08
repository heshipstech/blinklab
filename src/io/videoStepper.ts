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
const CALIBRATION_FRAMES = 5;

function nextFrame(
  video: VideoWithFrameCallback,
  timeoutMs = SEEK_TIMEOUT_MS,
): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    video.requestVideoFrameCallback((_nowMs, metadata) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(metadata.mediaTime);
    });
  });
}

async function seekTo(
  video: VideoWithFrameCallback,
  timeSeconds: number,
): Promise<number | null> {
  const pending = nextFrame(video);
  video.currentTime = timeSeconds;
  return pending;
}

/**
 * Learn the clip's frame interval by sampling its first few frames.
 *
 * Read from the frames themselves rather than from a container header,
 * because a header states an intention and this needs what the decoder
 * actually produces. Returns null when the clip is too short or the
 * samples disagree, and the caller then falls back to a nominal rate.
 */
async function measureFrameInterval(
  video: VideoWithFrameCallback,
): Promise<number | null> {
  const times: number[] = [];
  let probe = 0;
  for (let attempt = 0; attempt < CALIBRATION_FRAMES * 2; attempt += 1) {
    const mediaTime = await seekTo(video, probe);
    if (mediaTime === null) break;
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
    probe = Math.max(probe, mediaTime) + 0.004;
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
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median === undefined) return null;
  // A clip claiming frames a microsecond or ten seconds apart is not
  // something to build a seek schedule on.
  if (!Number.isFinite(median) || median <= 0.001 || median > 1) return null;
  return median;
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
  // 60 frames per second if the clip will not say. Too small a guess
  // only costs repeated seeks onto the same frame, which are detected
  // and skipped; too large a guess would silently miss frames, so the
  // fallback errs fast.
  const step = interval ?? 1 / 60;

  let index = 0;
  let lastMediaTimeSeconds: number | null = null;

  // Start from the very beginning again, since calibration moved us.
  let target = 0;
  const duration = Number.isFinite(video.duration) ? video.duration : null;

  for (;;) {
    if (shouldStop()) {
      return {
        framesMeasured: index,
        lastMediaTimeSeconds,
        frameIntervalSeconds: interval,
        stoppedEarly: true,
      };
    }
    if (duration !== null && target > duration) break;

    const mediaTimeSeconds = await seekTo(video, target);
    if (mediaTimeSeconds === null) break;

    if (
      lastMediaTimeSeconds !== null &&
      mediaTimeSeconds <= lastMediaTimeSeconds
    ) {
      // The seek landed on the frame already shown, which happens when
      // the step is slightly under the true interval. Push forward by
      // half a frame and try again rather than counting it twice.
      target += step / 2;
      continue;
    }

    await onFrame({ mediaTimeSeconds, index });
    lastMediaTimeSeconds = mediaTimeSeconds;
    index += 1;
    // Aim at the middle of the next frame's window. Landing on an edge
    // is what makes a seek ambiguous between two frames.
    target = mediaTimeSeconds + step * 1.5;
  }

  return {
    framesMeasured: index,
    lastMediaTimeSeconds,
    frameIntervalSeconds: interval,
    stoppedEarly: false,
  };
}
