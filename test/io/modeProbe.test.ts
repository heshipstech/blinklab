import { describe, expect, it } from "vitest";

import type { ModeAsk } from "../../src/core/modeMenu";
import {
  applyModeAsk,
  probeModes,
  type ProbeTrack,
} from "../../src/io/modeProbe";

// Roadmap 13.7's io half. The probe asks the live track each
// canonical trade and reads what it NEGOTIATED, on 13.2's pattern: a
// refusing track is recorded, never thrown, and the sweep ends by
// restoring what the session had, because a probe is a question and
// a question must not change the instrument it asked.

type Call = { kind: "apply"; constraints: MediaTrackConstraints };

function fakeTrack(
  grant: (asked: MediaTrackConstraints) => MediaTrackSettings | Error,
  initial: MediaTrackSettings = { width: 1280, height: 720, frameRate: 30 },
): { track: ProbeTrack; calls: Call[] } {
  let settings = initial;
  const calls: Call[] = [];
  const track: ProbeTrack = {
    applyConstraints: (constraints: MediaTrackConstraints) => {
      calls.push({ kind: "apply", constraints });
      const outcome = grant(constraints);
      if (outcome instanceof Error) {
        return Promise.reject(outcome);
      }
      settings = outcome;
      return Promise.resolve();
    },
    getSettings: () => settings,
  };
  return { track, calls };
}

const ASKS: ModeAsk[] = [
  { widthPx: 1920, heightPx: 1080, fps: 30 },
  { widthPx: 1280, heightPx: 720, fps: 60 },
];

describe("the sweep records what each ask negotiated", () => {
  it("one reading per ask, from the track's own settings", async () => {
    const { track } = fakeTrack(() => ({
      width: 1920,
      height: 1080,
      frameRate: 30,
    }));
    const readings = await probeModes(track, ASKS);
    expect(readings).toHaveLength(2);
    expect(readings[0]?.negotiated).toEqual({
      widthPx: 1920,
      heightPx: 1080,
      frameRate: 30,
    });
    expect(readings[1]?.asked).toEqual(ASKS[1]);
  });

  it("a refusing ask is recorded and the sweep continues", async () => {
    let first = true;
    const { track } = fakeTrack(() => {
      if (first) {
        first = false;
        return new Error("overconstrained");
      }
      return { width: 1280, height: 720, frameRate: 60 };
    });
    const readings = await probeModes(track, ASKS);
    expect(readings[0]?.applyFailed).toBe(true);
    expect(readings[0]?.negotiated).toEqual({
      widthPx: null,
      heightPx: null,
      frameRate: null,
    });
    expect(readings[1]?.applyFailed).toBe(false);
  });

  it("settings the browser keeps to itself read as null, never zero", async () => {
    const { track } = fakeTrack(() => ({}));
    const readings = await probeModes(track, ASKS.slice(0, 1));
    expect(readings[0]?.negotiated).toEqual({
      widthPx: null,
      heightPx: null,
      frameRate: null,
    });
  });

  it("restores the pre-probe settings after the sweep", async () => {
    // A probe is a question. The last call must carry the settings
    // the session had before the first ask, as ideals.
    const { track, calls } = fakeTrack(() => ({
      width: 1920,
      height: 1080,
      frameRate: 30,
    }));
    await probeModes(track, ASKS);
    const last = calls[calls.length - 1]?.constraints as {
      width?: { ideal?: number };
      frameRate?: { ideal?: number };
    };
    expect(calls).toHaveLength(ASKS.length + 1);
    expect(last.width?.ideal).toBe(1280);
    expect(last.frameRate?.ideal).toBe(30);
  });
});

describe("choosing a mode", () => {
  it("applies the ask and reports success", async () => {
    const { track, calls } = fakeTrack(() => ({
      width: 1280,
      height: 720,
      frameRate: 60,
    }));
    const ask = ASKS[1];
    if (ask === undefined) throw new Error("fixture");
    await expect(applyModeAsk(track, ask)).resolves.toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("a refusal reports false rather than throwing", async () => {
    const { track } = fakeTrack(() => new Error("no"));
    const ask = ASKS[0];
    if (ask === undefined) throw new Error("fixture");
    await expect(applyModeAsk(track, ask)).resolves.toBe(false);
  });
});
