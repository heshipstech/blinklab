import { describe, expect, it } from "vitest";

import {
  INEXACT_LANDING_TOLERANCE,
  checkLandings,
} from "../../src/core/stepCalibration";
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
//
// And the September audit's critical finding (docs/stepper-honesty.txt):
// every fixture was also CONSTANT RATE, so nothing could see a
// calibration that took one short gap for the clip's period and then
// measured the same frame twice under invented timestamps. The fake
// below takes an explicit list of frame times so that a clip can be
// anything a decoder might produce.

type FakeOptions = {
  /** Where each frame starts, in seconds, strictly increasing. */
  frameTimes: number[];
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

/** The frame times of a constant rate clip. */
function constantRate(
  startsAt: number,
  interval: number,
  frames: number,
): number[] {
  return Array.from({ length: frames }, (_, k) => startsAt + k * interval);
}

/** Frame times from a repeating pattern of gaps, in seconds. */
function fromGaps(
  startsAt: number,
  pattern: number[],
  frames: number,
): number[] {
  const times = [startsAt];
  for (let k = 1; k < frames; k += 1) {
    const gap = pattern[(k - 1) % pattern.length] ?? 0;
    times.push((times[k - 1] ?? 0) + gap);
  }
  return times;
}

/**
 * A video element that decodes frames only where frames exist.
 *
 * The one behaviour that matters: seeking into empty space fires
 * `seeked` and produces NO frame callback, because there was nothing
 * to decode. That is what a real decoder does, and what the old origin
 * assumption could not survive. Seeking onto the frame already showing
 * produces no callback either, which is the mechanism behind the
 * invented-timestamp defect.
 */
function fakeVideo(options: FakeOptions): {
  video: VideoWithFrameCallback;
  seeks: number[];
} {
  const {
    frameTimes,
    claimsStartAt = 0,
    silentFrameCallback = false,
    answersOnly = Number.POSITIVE_INFINITY,
  } = options;
  const startsAt = frameTimes[0] ?? 0;
  const lastFrameStart = frameTimes[frameTimes.length - 1] ?? startsAt;
  const lastGap =
    frameTimes.length >= 2
      ? lastFrameStart - (frameTimes[frameTimes.length - 2] ?? 0)
      : 1 / 30;
  const end = lastFrameStart + lastGap;
  const seeks: number[] = [];
  let currentTime = 0;
  let displayed: number | null = null;
  let answered = 0;
  const seekedListeners = new Set<() => void>();
  const pending: ((mediaTime: number) => void)[] = [];

  const frameAt = (time: number): number | null => {
    if (time < startsAt || time >= end) return null;
    let landed = startsAt;
    for (const start of frameTimes) {
      if (start > time) break;
      landed = start;
    }
    return landed;
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
      frameTimes: constantRate(1.7, 1 / 30, 40),
      claimsStartAt: 0,
    });
    const seen: number[] = [];
    const summary = await stepThroughVideo(video, (frame) => {
      seen.push(frame.mediaTimeSeconds);
    });

    expect(summary.framesMeasured).toBe(40);
    expect(summary.frameIntervalSeconds).toBeCloseTo(1 / 30, 6);
    expect(summary.stoppedEarly).toBe(false);
    expect(summary.inexactLandings).toBe(0);
    // The FIRST frame, not the seventh: an origin half a second late
    // would still "measure" a plausible number of frames while missing
    // the opening of every recording.
    expect(seen[0]).toBeCloseTo(1.7, 3);
  }, 30_000);

  it("still measures a clip that starts at zero, in the ordinary way", async () => {
    const { video } = fakeVideo({ frameTimes: constantRate(0, 1 / 30, 20) });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(20);
    expect(summary.stoppedEarly).toBe(false);
    expect(summary.inexactLandings).toBe(0);
  }, 30_000);

  it("does not waste the whole probe budget crossing the gap", async () => {
    // The budget that could not: sixty probes at ten milliseconds
    // covered 0.6 s of a 1.7 s gap, so the search never arrived.
    const { video, seeks } = fakeVideo({
      frameTimes: constantRate(1.7, 1 / 30, 10),
      claimsStartAt: 0,
    });
    await stepThroughVideo(video, () => {});
    const beforeTheFirstFrame = seeks.filter((at) => at < 1.7).length;
    expect(beforeTheFirstFrame).toBeLessThan(30);
  }, 30_000);

  it("keeps the origin when the browser stops saying where it landed, and counts every frame it had to invent", async () => {
    // The August audit found this and called it inert: the schedule
    // aims at `origin + (index + 0.5) * step` but the fallback for an
    // imprecise landing returned `index * step`, dropping the origin
    // entirely. It was inert only because the committed preparation
    // tool normalises every corpus clip's timeline to zero. A clip
    // that really does start late makes it live, and the symptom is
    // silent: every frame after the browser goes quiet is reported
    // 1.7 seconds early, which on a benchmark indexed by frame number
    // would shift the annotations against the video.
    //
    // Since docs/stepper-honesty.txt those invented times are COUNTED,
    // and a run with this many of them is refused by the wiring: a
    // frame without a time of its own is not a measurement.
    const startsAt = 1.7;
    const { video } = fakeVideo({
      frameTimes: constantRate(startsAt, 1 / 30, 40),
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
    expect(summary.inexactLandings).toBeGreaterThan(0);
    expect(
      checkLandings(summary.framesMeasured, summary.inexactLandings).kind,
    ).toBe("inexactLandings");
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
      frameTimes: constantRate(0, 1 / 30, 20),
      silentFrameCallback: true,
    });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(0);
    expect(summary.frameIntervalSeconds).toBeNull();
    expect(summary.stoppedEarly).toBe(true);
    expect(summary.calibration).toBeNull();
  }, 30_000);
});

describe("stepping a clip whose frames are not evenly spaced", () => {
  // The four cases docs/stepper-honesty.txt names. Two must measure
  // every frame with no invented time, two must end in a refusal by
  // name and never in a doubled rate.

  it("measures every frame of a 33/34 ms alternation with no inexact landing", async () => {
    // A 29.97 fps clip with millisecond timestamps. Stepped at the
    // smallest gap the schedule drifts a frame every ninety and lands
    // inside frames already showing; stepped at the mean period it
    // does not.
    const { video } = fakeVideo({
      frameTimes: fromGaps(0, [0.033, 0.034], 200),
    });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(200);
    expect(summary.inexactLandings).toBe(0);
    expect(summary.stoppedEarly).toBe(false);
    expect(summary.frameIntervalSeconds).toBeCloseTo(0.0335, 4);
  }, 30_000);

  it("measures every frame of a 33/33/34 ms clip, the other millisecond rounding", async () => {
    const { video } = fakeVideo({
      frameTimes: fromGaps(0, [0.033, 0.033, 0.034], 200),
    });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(200);
    expect(summary.inexactLandings).toBe(0);
    expect(summary.frameIntervalSeconds).toBeCloseTo(0.1 / 3, 4);
  }, 30_000);

  it("refuses by name a clip whose first frames hold a gap that is no multiple of the smallest", async () => {
    // 25 fps frames with one 25 ms gap among the calibration frames:
    // 40 / 25 is 1.6. Before this rule the step became 25 ms and the
    // clip measured at 40 fps.
    const times = constantRate(0, 0.04, 200);
    times.splice(4, 0, 0.16 - 0.015); // a frame 25 ms before frame 4
    const { video } = fakeVideo({ frameTimes: times });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.framesMeasured).toBe(0);
    expect(summary.stoppedEarly).toBe(true);
    expect(summary.frameIntervalSeconds).toBeNull();
    expect(summary.calibration?.kind).toBe("variableRate");
  }, 30_000);

  it("keeps a 20 fps clip with a half-period glitch refused, never reported as 40 fps", async () => {
    // THE REPRODUCED CASE. 50 ms frames with one 25 ms gap among the
    // first frames: 50 is a whole multiple of 25, so calibration
    // cannot tell the glitch from a skipped probe and steps at 25 ms.
    // Every other target then lands inside the frame already showing.
    // Before this rule those landings were invented timestamps and the
    // clip reported twice its frames at 40 fps, through the 25 fps
    // refusal. Now they are counted, and the count refuses the run.
    // Forty frames, not two hundred: every inexact landing waits out
    // the frame-callback grace, and the fraction is the point.
    const times = constantRate(0, 0.05, 40);
    times.splice(4, 0, 0.2 - 0.025);
    const { video } = fakeVideo({ frameTimes: times });
    const summary = await stepThroughVideo(video, () => {});
    expect(summary.frameIntervalSeconds).toBeCloseTo(0.025, 4);
    expect(summary.inexactLandings).toBeGreaterThan(
      summary.framesMeasured * INEXACT_LANDING_TOLERANCE,
    );
    expect(
      checkLandings(summary.framesMeasured, summary.inexactLandings).kind,
    ).toBe("inexactLandings");
  }, 30_000);
});
