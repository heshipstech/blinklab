import type { VideoWithFrameCallback } from "./frameLoop";

// Stepping a clip, rather than watching it.
//
// Increment 7.0 measures a clip while it plays, which means the
// measurement rate is whatever the model manages on that machine. In
// CI that was 3230 ms per frame against a clip running at 10 frames
// per second: one frame in nineteen was seen. The same file therefore
// produced different data on different hardware, which is fine for a
// live camera and fatal for a benchmark. A result that depends on the
// reviewer's laptop is not a result.
//
// So the clip waits for the instrument instead of the other way round.
// Each decoded frame is presented, the video is paused inside the frame
// callback itself, the whole pipeline runs to completion, and only then
// does playback resume for one more frame.
//
// Pausing inside the callback is the load bearing detail. Pausing after
// an await would hand control back to the browser first, and several
// more frames would present in the gap, which is the very thing being
// fixed.

export type SteppedFrame = {
  mediaTimeSeconds: number;
  index: number;
};

export type StepSummary = {
  framesMeasured: number;
  lastMediaTimeSeconds: number | null;
  stoppedEarly: boolean;
};

function nextPresentedFrame(
  video: VideoWithFrameCallback,
): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;

    function onEnded(): void {
      if (settled) return;
      settled = true;
      video.removeEventListener("ended", onEnded);
      resolve(null);
    }

    video.addEventListener("ended", onEnded);
    video.requestVideoFrameCallback((_nowMs, metadata) => {
      // Synchronously, before anything can await. See the note above.
      video.pause();
      if (settled) return;
      settled = true;
      video.removeEventListener("ended", onEnded);
      resolve(metadata.mediaTime);
    });
  });
}

/**
 * Walk a clip one decoded frame at a time, awaiting the callback for
 * each frame before allowing the next.
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

  let index = 0;
  let lastMediaTimeSeconds: number | null = null;

  for (;;) {
    if (shouldStop()) {
      return {
        framesMeasured: index,
        lastMediaTimeSeconds,
        stoppedEarly: true,
      };
    }
    if (video.ended) {
      return {
        framesMeasured: index,
        lastMediaTimeSeconds,
        stoppedEarly: false,
      };
    }

    const pending = nextPresentedFrame(video);
    try {
      await video.play();
    } catch {
      // Playback refused, which on a stepped run means the clip is over
      // or the element was torn down under us. Either way there is no
      // next frame to wait for.
      return {
        framesMeasured: index,
        lastMediaTimeSeconds,
        stoppedEarly: true,
      };
    }

    const mediaTimeSeconds = await pending;
    if (mediaTimeSeconds === null) {
      return {
        framesMeasured: index,
        lastMediaTimeSeconds,
        stoppedEarly: false,
      };
    }

    // The pipeline runs here, and the clip is paused for all of it.
    await onFrame({ mediaTimeSeconds, index });
    lastMediaTimeSeconds = mediaTimeSeconds;
    index += 1;
  }
}
