import { describe, expect, it } from "vitest";

import {
  acceptFrame,
  frameTimestampMs,
  sourceMetadataRows,
  startFrameClock,
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

  it("rejects the same timestamp twice, which is the duplicate frame", () => {
    // A 30 fps clip offers the same decoded frame to two 60 Hz ticks.
    // Counting it twice would double it in every rolling window.
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
    // Six 60 Hz ticks over three 30 fps frames: accept, reject, accept,
    // reject, accept, reject. The clock must land on the third frame.
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

  it("flattens a newline in a filename so it cannot inject a data row", () => {
    // The metadata block is comment lines. A raw newline would end the
    // comment and the rest of the filename would parse as CSV data.
    const rows = sourceMetadataRows("file", "evil\n1,2,3");
    expect(rows[1]).toBe("# clip: evil 1,2,3");
    expect(rows.join("\n").split("\n")).toHaveLength(2);
  });
});
