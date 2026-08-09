import { describe, expect, it } from "vitest";

import {
  acceptFrame,
  checkStepping,
  coverageMetadataRows,
  frameTimestampMs,
  sourceMetadataRows,
  startFrameClock,
  steppingProgress,
  steppingWarning,
} from "../../src/core/frameClock";

describe("acceptFrame", () => {
  it("accepts the first frame whatever its timestamp", () => {
    const step = acceptFrame(startFrameClock(), 0);
    expect(step.accepted).toBe(true);
    expect(step.state.lastAcceptedMs).toBe(0);
  });

  it("accepts a timestamp that moved forward", () => {
    const first = acceptFrame(startFrameClock(), 100);
    const second = acceptFrame(first.state, 133);
    expect(second.accepted).toBe(true);
    expect(second.state.lastAcceptedMs).toBe(133);
  });

  it("rejects the same timestamp twice", () => {
    // Correcting a claim this test used to make. It said a 30 fps clip
    // offers the same decoded frame to two 60 Hz display ticks, and
    // that a media clock would show them as one timestamp. That is
    // false: video.currentTime is INTERPOLATED during playback, so it
    // reads a different value on every tick. Review proved it on a
    // real 10 fps clip, where 482 display ticks produced 482 distinct
    // timestamps for 21 decoded frames. The fix was to stop sampling
    // currentTime at all and drive clips from requestVideoFrameCallback,
    // whose mediaTime IS frame quantised.
    //
    // The gate still earns its place. A frame callback repeats the same
    // mediaTime when playback stalls or pauses, and a repeated
    // timestamp must never be counted twice in a rolling window.
    const first = acceptFrame(startFrameClock(), 100);
    const second = acceptFrame(first.state, 100);
    expect(second.accepted).toBe(false);
    expect(second.state.lastAcceptedMs).toBe(100);
  });

  it("rejects a backwards timestamp, which is what a seek produces", () => {
    const first = acceptFrame(startFrameClock(), 5000);
    const second = acceptFrame(first.state, 1000);
    expect(second.accepted).toBe(false);
    expect(second.state.lastAcceptedMs).toBe(5000);
  });

  it("rejects a non-finite timestamp rather than poisoning the clock", () => {
    // currentTime reads NaN before metadata loads. One NaN through the
    // gate makes every later comparison false, so the clock would
    // accept nothing again, or everything, depending on the operator.
    const start = startFrameClock();
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
      const step = acceptFrame(start, bad);
      expect(step.accepted).toBe(false);
      expect(step.state.lastAcceptedMs).toBeNull();
    }
  });

  it("keeps rejecting duplicates without drifting the accepted time", () => {
    // A stalled clip: each media time is delivered twice before the
    // next frame decodes. The clock must land on the third frame, not
    // somewhere between.
    let state = startFrameClock();
    const offered = [0, 0, 33.3, 33.3, 66.6, 66.6];
    const accepted: number[] = [];
    for (const candidate of offered) {
      const step = acceptFrame(state, candidate);
      state = step.state;
      if (step.accepted) accepted.push(candidate);
    }
    expect(accepted).toEqual([0, 33.3, 66.6]);
    expect(state.lastAcceptedMs).toBe(66.6);
  });
});

describe("frameTimestampMs", () => {
  it("uses the wall clock for the camera", () => {
    expect(frameTimestampMs("camera", 12345, 7)).toBe(12345);
  });

  it("uses the media position for a file, converted to milliseconds", () => {
    expect(frameTimestampMs("file", 12345, 7)).toBe(7000);
  });

  it("keeps a file's time axis independent of how fast it is processed", () => {
    // This is the whole reason the function exists. A ten minute clip
    // processed in thirty seconds of wall time must still report ten
    // minutes, or every rate and duration downstream is wrong by the
    // ratio between them.
    const tenMinutesOfMedia = 600;
    const thirtySecondsOfWall = 30_000;
    expect(
      frameTimestampMs("file", thirtySecondsOfWall, tenMinutesOfMedia),
    ).toBe(600_000);
  });

  it("starts a file at zero rather than at whatever the page has been open", () => {
    expect(frameTimestampMs("file", 999_999, 0)).toBe(0);
  });
});

describe("sourceMetadataRows", () => {
  it("records a live session as camera with no clip", () => {
    expect(sourceMetadataRows("camera", null)).toEqual([
      "# source: camera",
      "# clip: none",
    ]);
  });

  it("records a clip by name", () => {
    expect(sourceMetadataRows("file", "06_5.mp4")).toEqual([
      "# source: file",
      "# clip: 06_5.mp4",
    ]);
  });

  it("never claims a clip name on a camera session", () => {
    // A stale name left over from a previous clip must not be able to
    // relabel a live recording as a dataset one.
    expect(sourceMetadataRows("camera", "leftover.mp4")).toEqual([
      "# source: camera",
      "# clip: none",
    ]);
  });

  it("writes none rather than an empty value for a nameless clip", () => {
    expect(sourceMetadataRows("file", "")).toEqual([
      "# source: file",
      "# clip: none",
    ]);
  });

  it("flattens a bare carriage return, not only a newline", () => {
    // Review found this gap. The old pattern was /\r?\n/, which leaves
    // a lone \r untouched, and a lone \r ends a line for a CSV reader
    // and for Python's universal newline mode, so this project's own
    // loader would refuse the file it had just written.
    const rows = sourceMetadataRows("file", "evil\r1,2,3");
    expect(rows[1]).toBe("# clip: evil 1,2,3");
    expect(rows[1]).not.toContain("\r");
  });

  it("flattens a newline in a filename so it cannot inject a data row", () => {
    // The metadata block is comment lines. A raw newline would end the
    // comment and the rest of the filename would parse as CSV data.
    const rows = sourceMetadataRows("file", "evil\n1,2,3");
    expect(rows[1]).toBe("# clip: evil 1,2,3");
    expect(rows.join("\n").split("\n")).toHaveLength(2);
  });
});

describe("coverageMetadataRows", () => {
  it("records a stepped run with its true measured rate", () => {
    expect(coverageMetadataRows("stepped", 300, 10)).toEqual([
      "# measurement_mode: stepped",
      "# frames_measured: 300",
      "# clip_duration_s: 10.000",
      "# measured_fps: 30.00",
    ]);
  });

  it("makes an under-sampled played run visible", () => {
    // The exact case issue #145 describes: a 10 fps clip of which one
    // frame in nineteen was seen. Nothing else in the file says so, and
    // averaging this alongside a complete run mixes two measurements.
    const rows = coverageMetadataRows("played", 1, 1.9);
    expect(rows).toContain("# measurement_mode: played");
    expect(rows).toContain("# frames_measured: 1");
    expect(rows).toContain("# measured_fps: 0.53");
  });

  it("says unknown rather than guessing when duration is not known", () => {
    // A WebM from a recorder often carries no duration, which reads as
    // Infinity. Dividing by it would print 0.00 and claim the clip was
    // never measured, which is a lie about a real measurement.
    const rows = coverageMetadataRows("stepped", 42, Number.POSITIVE_INFINITY);
    expect(rows).toContain("# clip_duration_s: unknown");
    expect(rows).toContain("# measured_fps: unknown");
    expect(rows).toContain("# frames_measured: 42");
  });

  it("says unknown for a live session with no duration at all", () => {
    const rows = coverageMetadataRows("live", 900, null);
    expect(rows).toContain("# measurement_mode: live");
    expect(rows).toContain("# clip_duration_s: unknown");
  });

  it("refuses to divide by a zero length clip", () => {
    const rows = coverageMetadataRows("stepped", 0, 0);
    expect(rows).toContain("# measured_fps: unknown");
  });
});

describe("steppingProgress", () => {
  it("reports count, percentage and an estimate once there is enough to estimate from", () => {
    // A fifth of a 200 second clip done in 60 seconds of wall time
    // implies four more minutes.
    const message = steppingProgress(1200, 40, 200, 60_000);
    expect(message).toContain("1200 done");
    expect(message).toContain("20% of the clip");
    expect(message).toContain("about 4 min left");
  });

  it("withholds the estimate until a twentieth of the clip is done", () => {
    // The first inference is far slower than the rest, so an estimate
    // from two frames would be wildly high and then visibly shrink,
    // which reads as broken rather than as improving.
    const message = steppingProgress(3, 2, 200, 9000);
    expect(message).toContain("1% of the clip");
    expect(message).not.toContain("left");
  });

  it("still says something useful when the clip has no known duration", () => {
    // A WebM from a recorder often carries no duration, which reads as
    // Infinity. A percentage of infinity is not a number worth showing.
    const message = steppingProgress(500, 12, Number.POSITIVE_INFINITY, 30_000);
    expect(message).toContain("500 done");
    expect(message).toContain("several minutes");
    expect(message).not.toContain("%");
  });

  it("survives a zero length clip without dividing by it", () => {
    expect(steppingProgress(0, 0, 0, 0)).toContain("0 done");
  });

  it("never claims more than one hundred percent", () => {
    // mediaTime can exceed a container's declared duration by a frame.
    const message = steppingProgress(6000, 201, 200, 400_000);
    expect(message).toContain("100% of the clip");
  });

  it("switches from seconds to minutes rather than saying 300 s", () => {
    expect(steppingProgress(100, 10, 200, 30_000)).toContain("min left");
    expect(steppingProgress(100, 100, 200, 30_000)).toContain("30 s left");
  });
});

describe("checkStepping, did the stepper visit frames twice", () => {
  it("is happy when every sought frame was a new one", () => {
    expect(checkStepping(3600, 3600, 120).kind).toBe("ok");
  });

  // THE REAL CASE. DROZY clip 1-2 is 15 frames per second. Calibration
  // produced a 30 fps interval, so the stepper sought 3600 frames and
  // only 1800 were new. The status line reported "3600 frames at 30.0
  // frames per second" and hid the fault. Issue #193.
  it("catches a 15 fps clip stepped at a 30 fps interval", () => {
    const check = checkStepping(3600, 1800, 120);
    expect(check.kind).toBe("duplicateVisits");
    if (check.kind !== "duplicateVisits") throw new Error("expected a warning");
    expect(check.sought).toBe(3600);
    expect(check.measured).toBe(1800);
    // The rate that is TRUE, from frames actually measured over the
    // clip's own duration, not from the interval that was wrong.
    expect(check.trueRate).toBeCloseTo(15, 5);
  });

  it("tolerates the odd duplicate seek without crying wolf", () => {
    // A seek landing on the frame already showing is possible once
    // calibration has succeeded. One in a hundred is luck, not a fault.
    expect(checkStepping(3600, 3580, 120).kind).toBe("ok");
  });

  it("says nothing useful is known when the duration is missing", () => {
    const check = checkStepping(3600, 1800, null);
    if (check.kind !== "duplicateVisits") throw new Error("expected a warning");
    expect(check.trueRate).toBeNull();
  });

  it("does not fire on an empty run, which is a different failure", () => {
    expect(checkStepping(0, 0, 120).kind).toBe("ok");
  });

  it("names both counts and the true rate in the warning", () => {
    const text = steppingWarning(checkStepping(3600, 1800, 120));
    expect(text).toContain("3600");
    expect(text).toContain("1800");
    expect(text).toContain("15.0 frames per second");
    // The reader must not be left thinking their data is ruined.
    expect(text).toContain("exported file");
  });

  it("says nothing at all when there is nothing to say", () => {
    expect(steppingWarning({ kind: "ok" })).toBe("");
  });
});
