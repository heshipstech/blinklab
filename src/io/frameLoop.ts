// A throw in onFrame ends the loop AND reports it. Both halves
// matter, and remediation B3 is why. Without the catch, the throw
// skips the re-arm and the page freezes silently, every readout
// stuck on its last value. With a catch that resumed, the throw
// would repeat at sixty a second while the page looked healthy,
// which is this project's own recurring defect wearing a fix's
// clothing. So: report once, stop for good, let the caller say so.
export function startFrameLoop(
  onFrame: (nowMs: number) => void,
  onCrash: (error: unknown) => void,
): void {
  function tick(nowMs: number): void {
    try {
      onFrame(nowMs);
    } catch (error: unknown) {
      onCrash(error);
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// requestVideoFrameCallback fires once per DECODED frame and hands back
// that frame's own media time. requestAnimationFrame cannot do this
// job, and the reason is subtle enough that it is worth stating.
//
// The obvious approach is to tick at display rate and read
// video.currentTime. That reading is wrong. currentTime is
// INTERPOLATED from the media clock during playback, not quantised to
// decoded frames, so a 10 frame per second clip reports a different
// currentTime on every one of the display's 60 ticks. Measured on a
// real 10 fps clip: 482 ticks over two seconds, every one of them a
// different timestamp, while only 21 frames were actually decoded. The
// instrument would then report the display's refresh rate as the
// clip's frame rate, and the frame rate gate that exists to refuse
// sources too coarse to see a blink would never refuse anything.
//
// So a clip is driven by the frames themselves.

type VideoFrameMetadata = { mediaTime: number };
type VideoFrameCallback = (nowMs: number, metadata: VideoFrameMetadata) => void;
export type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback: (handle: number) => void;
};

export function supportsVideoFrameCallback(
  video: HTMLVideoElement,
): video is VideoWithFrameCallback {
  return "requestVideoFrameCallback" in video;
}

export type VideoFrameLoop = {
  stop: () => void;
};

/**
 * Run a callback once per decoded frame, with that frame's media time
 * in seconds.
 *
 * Returns a handle whose stop() ends the loop, because unlike the
 * display loop this one belongs to a particular clip and must not
 * outlive it.
 */
export function startVideoFrameLoop(
  video: VideoWithFrameCallback,
  onFrame: (mediaTimeSeconds: number) => void,
  // Same contract as startFrameLoop's: a throw reports once and ends
  // the loop, because this loop dying silently mid-clip is the same
  // frozen page with a different driver.
  onCrash: (error: unknown) => void,
): VideoFrameLoop {
  let stopped = false;
  let handle: number | null = null;

  function tick(_nowMs: number, metadata: VideoFrameMetadata): void {
    if (stopped) return;
    try {
      onFrame(metadata.mediaTime);
    } catch (error: unknown) {
      stopped = true;
      onCrash(error);
      return;
    }
    handle = video.requestVideoFrameCallback(tick);
  }

  handle = video.requestVideoFrameCallback(tick);

  return {
    stop: () => {
      stopped = true;
      if (handle !== null) {
        video.cancelVideoFrameCallback(handle);
        handle = null;
      }
    },
  };
}
