import { describe, expect, it } from "vitest";

import { loadVideoFile } from "../../src/io/videoFile";

// The wait that never happened. The 8 August Safari fix (#154) said,
// in its commit message and in a comment, that loading waits for
// `canplay` rather than `loadedmetadata`, because a stepped run needs
// actual frame data and seeking before any exists is what measured
// zero frames. The code added the canplay listener and FORGOT TO
// REMOVE the loadedmetadata one, so the promise resolved on whichever
// fired first — and metadata always fires first. The intended wait
// never existed. It stayed invisible because preload="auto", the same
// fix's other half, made every file tried so far decodable before the
// stepper's first seek timed out; the first 8.8 minute corpus clip on
// a fresh machine lost that race and refused with "could not work out
// this clip's frame rate", which blamed the file for the loader's
// impatience.

type Listener = () => void;

function fakeVideo() {
  const listeners = new Map<string, Set<Listener>>();
  const video = {
    preload: "",
    src: "",
    srcObject: null as MediaStream | null,
    videoWidth: 640,
    videoHeight: 480,
    duration: 528.4,
    pause(): void {},
    load(): void {},
    removeAttribute(): void {},
    addEventListener(name: string, fn: Listener): void {
      const set = listeners.get(name) ?? new Set<Listener>();
      set.add(fn);
      listeners.set(name, set);
    },
    removeEventListener(name: string, fn: Listener): void {
      listeners.get(name)?.delete(fn);
    },
  };
  return {
    video: video as unknown as HTMLVideoElement,
    fire(event: string): void {
      for (const fn of [...(listeners.get(event) ?? [])]) fn();
    },
  };
}

/** Whether a promise has settled, without waiting long for it. */
function settled(promise: Promise<unknown>): Promise<"settled" | "pending"> {
  return Promise.race([
    promise.then(
      () => "settled" as const,
      () => "settled" as const,
    ),
    new Promise<"pending">((resolve) => {
      setTimeout(() => {
        resolve("pending");
      }, 25);
    }),
  ]);
}

const CLIP = new File([""], "clip.mp4");

describe("loadVideoFile waits for frames, not just for metadata", () => {
  it("does not resolve on loadedmetadata alone — the decoder is not ready", async () => {
    const { video, fire } = fakeVideo();
    const loading = loadVideoFile(video, CLIP);
    fire("loadedmetadata");
    expect(await settled(loading)).toBe("pending");
    fire("canplay");
    await loading;
  });

  it("resolves on canplay, with the clip's own dimensions and duration", async () => {
    const { video, fire } = fakeVideo();
    const loading = loadVideoFile(video, CLIP);
    fire("canplay");
    expect(await loading).toEqual({
      widthPx: 640,
      heightPx: 480,
      name: "clip.mp4",
      durationSeconds: 528.4,
    });
  });

  it("rejects a file the browser cannot decode, naming the file", async () => {
    const { video, fire } = fakeVideo();
    const loading = loadVideoFile(video, CLIP);
    fire("error");
    await expect(loading).rejects.toThrow(/could not decode clip\.mp4/);
  });
});
