import { describe, expect, it } from "vitest";

import {
  FIRST_FRAME_SEARCH_LIMIT_S,
  findFirstFrame,
  type FrameProbe,
} from "../../src/core/frameSearch";

// The 25 August 2026 failure, in miniature. Every clip of the
// Eyeblink8 corpus refused on a new machine — "could not work out this
// clip's frame rate" — while a sixty second cut of the byte-identical
// stream measured perfectly. The clips begin 1.7 seconds into their
// own timeline; the browser reported the seekable range as starting at
// zero; the stepper believed it and probed empty space, where seeks
// finish and frames never come.

/**
 * A clip whose frames begin at `startsAt`, every `interval` seconds.
 * Seeking below the first frame lands in emptiness, exactly as a real
 * decoder behaves: the seek completes and nothing is decoded.
 */
function clip(startsAt: number, interval = 1 / 30, endsAt = 527.8) {
  const probes: number[] = [];
  const probe: FrameProbe = (timeSeconds) => {
    probes.push(timeSeconds);
    if (timeSeconds < startsAt || timeSeconds > endsAt) {
      return Promise.resolve(null);
    }
    const index = Math.floor((timeSeconds - startsAt) / interval);
    return Promise.resolve(startsAt + index * interval);
  };
  return { probe, probes };
}

describe("findFirstFrame", () => {
  it("finds a frame at the start in a single probe", async () => {
    // Every ordinary clip. The search must not cost anything when
    // there is nothing to search for.
    const { probe } = clip(0);
    const found = await findFirstFrame(probe, 0, 527.8);
    expect(found.firstFrameSeconds).toBe(0);
    expect(found.probes).toBe(1);
  });

  it("finds the true first frame of a clip that starts 1.7 s in", async () => {
    // The real corpus clip: first frame at 1.700, seekable claiming
    // 0.00. The old code trusted the claim and never saw a frame.
    const { probe } = clip(1.7);
    const found = await findFirstFrame(probe, 0, 527.834);
    expect(found.firstFrameSeconds).toBeCloseTo(1.7, 3);
  });

  it("crosses the gap in far fewer probes than marching would", async () => {
    // The budget that could not: 60 probes at 10 ms covered 0.6 s of a
    // 1.7 s gap. Doubling crosses it in a handful, and the binary
    // search pins the boundary in a handful more.
    const { probe } = clip(1.7);
    const found = await findFirstFrame(probe, 0, 527.834);
    expect(found.probes).toBeLessThan(25);
  });

  it("lands on the first frame itself, not merely near it", async () => {
    // Off by one frame is not "close enough": the stepper schedules
    // every later frame from this origin, so an origin half a frame
    // late measures every frame of the clip at the wrong instant.
    const interval = 1 / 30;
    const { probe } = clip(1.7, interval);
    const found = await findFirstFrame(probe, 0, 527.834);
    expect(found.firstFrameSeconds).not.toBeNull();
    const first = found.firstFrameSeconds ?? 0;
    expect(Math.abs(first - 1.7)).toBeLessThan(interval / 2);
  });

  it("finds a frame that starts a long way in", async () => {
    const { probe } = clip(45);
    const found = await findFirstFrame(probe, 0, 600);
    expect(found.firstFrameSeconds).toBeCloseTo(45, 2);
  });

  it("refuses rather than inventing an origin when nothing is there", async () => {
    // A clip with no decodable frame at all. Returning zero here would
    // be the project's oldest mistake: a wrong number that looks
    // exactly like a right one.
    const probe: FrameProbe = () => Promise.resolve(null);
    const found = await findFirstFrame(probe, 0, 600);
    expect(found.firstFrameSeconds).toBeNull();
    expect(found.probes).toBeGreaterThan(1);
  });

  it("stops searching rather than scanning a whole recording", async () => {
    const { probe, probes } = clip(FIRST_FRAME_SEARCH_LIMIT_S + 60);
    const found = await findFirstFrame(probe, 0, 3600);
    expect(found.firstFrameSeconds).toBeNull();
    for (const at of probes) {
      expect(at).toBeLessThanOrEqual(FIRST_FRAME_SEARCH_LIMIT_S);
    }
  });

  it("never probes past the end of a short clip", async () => {
    const { probe, probes } = clip(90, 1 / 30, 100);
    await findFirstFrame(probe, 0, 5);
    for (const at of probes) {
      expect(at).toBeLessThanOrEqual(5);
    }
  });

  it("searches from the claimed start when the claim is honest", async () => {
    // A browser that reports the offset correctly should not be
    // punished for it: the first probe lands and the search ends.
    const { probe } = clip(1.7);
    const found = await findFirstFrame(probe, 1.7, 527.834);
    expect(found.firstFrameSeconds).toBeCloseTo(1.7, 6);
    expect(found.probes).toBe(1);
  });

  it("survives a non-finite claimed start", async () => {
    const { probe } = clip(0);
    const found = await findFirstFrame(probe, Number.NaN, 527.8);
    expect(found.firstFrameSeconds).toBe(0);
  });

  it("searches a bounded window when the clip has no known end", async () => {
    const { probe } = clip(1.7);
    const found = await findFirstFrame(probe, 0, null);
    expect(found.firstFrameSeconds).toBeCloseTo(1.7, 3);
  });
});
