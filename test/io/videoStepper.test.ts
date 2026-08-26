import { describe, expect, it } from "vitest";

import { stepThroughVideo } from "../../src/io/videoStepper";
import type { VideoWithFrameCallback } from "../../src/io/frameLoop";

// The corpus that refused. On 25 August 2026 all eight Eyeblink8 clips
// failed with "could not work out this clip's frame rate", on a
// machine where a sixty second cut of the byte-identical stream
// measured perfectly. The clips begin 1.700 seconds into their own
// timeline and the browser reported the seekable range as starting at
// 0.00 — a true statement about what may be ASKED FOR, read as a claim
// about where frames ARE. Seeks into that gap complete normally and
// decode nothing, so calibration collected no frames and the stepper
// refused, blaming the file.
//
// Nothing in the suite could see it: every fixture and every test clip
// began at zero, where the difference does not exist.

type FakeOptions = {
  startsAt: number;
  interval: number;
  frames: number;
  /** What `seekable` claims, which is not always the truth. */
  claimsStartAt?: number;
  /** A browser that never reports which frame it landed on. */
  silentFrameCallback?: boolean;
  /**
   * A browser that answers this many frame callbacks and then stops
   * saying where it landed. Calibration still succeeds; the main loop
   * then falls back to its own schedule, which is where the origin
   * used to be dropped.
   */
  answersOnly?: number;
};

/**
 * A video element that decodes frames only where frames exist.
 *
 * The one behaviour that matters: seeking into empty space fires
 * `seeked` and produces NO frame callback, because there was nothing
 * to decode. That is what a real decoder does, and what the old origin
 * assumption could not survive.
 */
function fakeVideo(options: FakeOptions): {
  video: VideoWithFrameCallback;
  seeks: number[];
} {
  const {
    startsAt,
    interval,
    frames,
    claimsStartAt = 0,
    silentFrameCallback = false,
    answersOnly = Number.POSITIVE_INFINITY,
  } = options;
  const lastFrameStart = startsAt + (frames - 1) * interval;
  const end = lastFrameStart + interval;
  const seeks: number[] = [];
  let currentTime = 0;
  let displayed: number | null = null;
  let answered = 0;
  const seekedListeners = new Set<() => void>();
  const pending: ((mediaTime: number) => void)[] = [];

  const frameAt = (time: number): number | null => {
    if (time < startsAt || time >= end) return null;
    const index = Math.floor((time - startsAt) / interval);
    return startsAt + index * interval;
  };

  const video = {
    duration: end,
    seekable: {
      length: 1,
      start: () => claimsStartAt,
      end: () => end,
    } as unknown as TimeRanges,
    get currentTime(): number {
      return currentTime;
    },
    set currentTime(next: number) {
      seeks.push(next);
      currentTime = next;
      const landed = frameAt(next);
      // A seek always completes, whether or not it decoded anything.
      queueMicrotask(() => {
        // A frame callback only fires when a NEW frame is decoded:
        // empty space decodes nothing, and landing on the frame
        // already showing decodes nothing either.
        if (
          landed !== null &&
          landed !== displayed &&
          !silentFrameCallback &&
          answered < answersOnly
        ) {
          answered += 1;
          displayed = landed;
          const waiting = pending.splice(0, pending.length);
          for (const resolve of waiting) resolve(landed);
        }
        for (const listener of [...seekedListeners]) listener();
      });
    },
    pause(): void {},
    addEventListener(name: string, fn: () => void): void {
      if (name === "seeked") seekedListeners.add(fn);
    },
    removeEventListener(name: string, fn: () => void): void {
      if (name === "seeked") seekedListeners.delete(fn);
    },
    requestVideoFrameCallback(
      callback: (now: number, metadata: { mediaTime: number }) => void,
    ): number {
      pending.push((mediaTime) => {
        callback(0, { mediaTime });
      });
      return pending.length;
    },
  };

  return { video: video as unknown as VideoWithFrameCallback, seeks };
}

describe("stepping a clip whose timeline does not start at zero", () => {
  it("measures every frame of a clip that begins 1.7 s in", async () => {
    // The real shape: 30 frames per second, first frame at 1.700, and
    // a browser claiming the seekable range starts at 0.00.
    const { video } = fakeVideo({
      startsAt: 1.7,
      interval: 1 / 30,
      frames: 40,
      claimsStartAt: 0,
    });
    const seen: number[] = [];
    const summary = await stepThroughVideo(video, (frame) => {
      seen.push(frame.mediaTimeSeconds);
    });

    expect(summary.framesMeasured).toBe(40);
    expect(summary.frameIntervalSeconds).toBeCloseTo(1 / 30, 6);
    expect(summary.stoppedEarly).toBe(false);
    // The FIRST frame, not the seventh: an origin half a second late
    // would still "measure" a plausible number of frames while missing
    // the opening of every recording.
    expect(seen[0]).toBeCloseTo(1.7, 3);
  }, 30_000);

  it("still measures a clip that starts at zero, in the ordinary way", async () => {
    const { video } = fakeVideo({ startsAt: 0, interval: 1 / 30, frames: 20 });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(20);
    expect(summary.stoppedEarly).toBe(false);
  }, 30_000);

  it("does not waste the whole probe budget crossing the gap", async () => {
    // The budget that could not: sixty probes at ten milliseconds
    // covered 0.6 s of a 1.7 s gap, so the search never arrived.
    const { video, seeks } = fakeVideo({
      startsAt: 1.7,
      interval: 1 / 30,
      frames: 10,
      claimsStartAt: 0,
    });
    await stepThroughVideo(video, () => {});
    const beforeTheFirstFrame = seeks.filter((at) => at < 1.7).length;
    expect(beforeTheFirstFrame).toBeLessThan(30);
  }, 30_000);

  it("keeps the origin when the browser stops saying where it landed", async () => {
    // The August audit found this and called it inert: the schedule
    // aims at `origin + (index + 0.5) * step` but the fallback for an
    // imprecise landing returned `index * step`, dropping the origin
    // entirely. It was inert only because the committed preparation
    // tool normalises every corpus clip's timeline to zero. A clip
    // that really does start late makes it live, and the symptom is
    // silent: every frame after the browser goes quiet is reported
    // 1.7 seconds early, which on a benchmark indexed by frame number
    // would shift the annotations against the video.
    const startsAt = 1.7;
    const { video } = fakeVideo({
      startsAt,
      interval: 1 / 30,
      frames: 40,
      claimsStartAt: 0,
      // Enough answers for the origin search and calibration, then
      // the browser goes quiet for the rest of the run.
      answersOnly: 20,
    });
    const seen: number[] = [];
    const summary = await stepThroughVideo(video, (frame) => {
      seen.push(frame.mediaTimeSeconds);
    });

    expect(summary.framesMeasured).toBeGreaterThan(8);
    // No frame may be reported before the clip begins.
    for (const at of seen) {
      expect(at).toBeGreaterThanOrEqual(startsAt - 1e-9);
    }
    // And the times must still march forward, one frame apart.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i] ?? 0).toBeGreaterThan(seen[i - 1] ?? 0);
    }
  }, 30_000);

  it("refuses, rather than inventing an origin, when nothing decodes", async () => {
    // A browser that never reports where it landed. Zero frames is a
    // failure and must be reported as one: the caller turns this into
    // a refusal on screen.
    const { video } = fakeVideo({
      startsAt: 0,
      interval: 1 / 30,
      frames: 20,
      silentFrameCallback: true,
    });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(0);
    expect(summary.frameIntervalSeconds).toBeNull();
    expect(summary.stoppedEarly).toBe(true);
  }, 30_000);
});
