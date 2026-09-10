import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachStream,
  negotiateFrameRate,
  requestCamera,
  stopCamera,
  stopStream,
} from "../../src/io/camera";
import { FRAME_RATE_ASK_FPS } from "../../src/core/frameRateNegotiation";

// Roadmap 14.0d (audit A5). startCamera used to request the stream,
// attach it to the video element and play it before returning, and
// the caller checked its run token only afterwards, so a start that
// had been superseded while the permission prompt was up left a live,
// unowned track behind for the page's life. Request and attach are
// now two steps with the token check between them, and a stream the
// caller no longer wants can be stopped without ever touching the
// element.

type FakeTrack = { readyState: "live" | "ended"; stop: () => void };

function fakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [
    {
      readyState: "live",
      stop(): void {
        this.readyState = "ended";
      },
    },
  ];
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
  } as unknown as MediaStream;
  return { stream, tracks };
}

function fakeVideo(): HTMLVideoElement & { played: number } {
  const video = {
    srcObject: null as MediaStream | null,
    videoWidth: 1280,
    videoHeight: 720,
    played: 0,
    play(): Promise<void> {
      this.played += 1;
      return Promise.resolve();
    },
  };
  return video as unknown as HTMLVideoElement & { played: number };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requesting a camera without attaching it", () => {
  it("asks for the device by exact id and returns the stream untouched", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi
      .fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    const requested = await requestCamera("cam-2");

    expect(requested).toBe(stream);
    const video = getUserMedia.mock.calls[0]?.[0].video as
      MediaTrackConstraints | undefined;
    expect(video?.deviceId).toEqual({ exact: "cam-2" });
  });

  it("names no device when none was asked for", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi
      .fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    await requestCamera();

    const video = getUserMedia.mock.calls[0]?.[0].video as
      MediaTrackConstraints | undefined;
    expect(video).toBeDefined();
    expect("deviceId" in (video ?? {})).toBe(false);
  });
});

describe("a superseded request", () => {
  it("can be stopped without ever reaching the element", () => {
    // The whole point: the caller learns its token lost, and the
    // stream it was handed dies here rather than living on unowned.
    const { stream, tracks } = fakeStream();
    const video = fakeVideo();

    stopStream(stream);

    expect(tracks[0]?.readyState).toBe("ended");
    expect(video.srcObject).toBeNull();
    expect(video.played).toBe(0);
  });
});

describe("attaching a stream", () => {
  it("plays it on the element and reports the negotiated frame size", async () => {
    const { stream } = fakeStream();
    const video = fakeVideo();

    const frame = await attachStream(video, stream);

    expect(video.srcObject).toBe(stream);
    expect(video.played).toBe(1);
    expect(frame).toEqual({ widthPx: 1280, heightPx: 720 });
  });

  it("stopping the camera afterwards ends every track and clears the element", () => {
    const { stream, tracks } = fakeStream();
    const video = fakeVideo();
    video.srcObject = stream;

    stopCamera(video);

    expect(tracks[0]?.readyState).toBe("ended");
    expect(video.srcObject).toBeNull();
  });
});

// Roadmap 13.2, brief C1: the ask for 60, made as a measurement. The
// io half performs the reads and the constraint; every judgement
// about what happened is core's (frameRateNegotiation.ts), so these
// tests only prove the reads happen in the right order, the ask is
// `ideal` rather than `exact`, and a browser that throws or lacks
// getCapabilities loses a diagnostic and never a session.

type NegotiableTrack = {
  getCapabilities?: () => { frameRate?: { max?: number } };
  getSettings: () => MediaTrackSettings;
  applyConstraints: (c: MediaTrackConstraints) => Promise<void>;
};

function negotiableStream(track: NegotiableTrack): MediaStream {
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

describe("asking the live track for 60 (roadmap 13.2)", () => {
  it("reads capabilities, settings before, asks ideal 60, reads after", async () => {
    let asked: MediaTrackConstraints | null = null;
    let settingsReads = 0;
    const track: NegotiableTrack = {
      getCapabilities: () => ({ frameRate: { max: 60 } }),
      getSettings: () => {
        settingsReads += 1;
        return settingsReads === 1
          ? { frameRate: 30, width: 1920, height: 1080 }
          : { frameRate: 60, width: 1920, height: 1080 };
      },
      applyConstraints: (c) => {
        asked = c;
        return Promise.resolve();
      },
    };

    const negotiation = await negotiateFrameRate(negotiableStream(track));

    expect(asked).toEqual({ frameRate: { ideal: FRAME_RATE_ASK_FPS } });
    expect(negotiation).toEqual({
      declaredMaxFps: 60,
      before: { frameRate: 30, widthPx: 1920, heightPx: 1080 },
      after: { frameRate: 60, widthPx: 1920, heightPx: 1080 },
      askedFps: FRAME_RATE_ASK_FPS,
      applyFailed: false,
    });
  });

  it("records a refusing browser rather than throwing at it", async () => {
    // A failed ask leaves the default negotiation standing, which is
    // a session worth having: the record says failed, the "after"
    // read still happens, and nothing propagates.
    const track: NegotiableTrack = {
      getSettings: () => ({ frameRate: 30, width: 1280, height: 720 }),
      applyConstraints: () =>
        Promise.reject(new Error("constraints not satisfiable")),
    };

    const negotiation = await negotiateFrameRate(negotiableStream(track));

    expect(negotiation?.applyFailed).toBe(true);
    expect(negotiation?.declaredMaxFps).toBeNull();
    expect(negotiation?.after).toEqual({
      frameRate: 30,
      widthPx: 1280,
      heightPx: 720,
    });
  });

  it("reads null for the whole step when the stream has no video track", async () => {
    const stream = {
      getVideoTracks: () => [],
      getTracks: () => [],
    } as unknown as MediaStream;
    expect(await negotiateFrameRate(stream)).toBeNull();
  });

  it("prefers the person-facing camera, as a preference", async () => {
    // facingMode ideal, never exact: a laptop webcam has no facing
    // mode to declare and must not be refused over one.
    const { stream } = fakeStream();
    const getUserMedia = vi
      .fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    await requestCamera();

    const video = getUserMedia.mock.calls[0]?.[0].video as
      MediaTrackConstraints | undefined;
    expect(video?.facingMode).toEqual({ ideal: "user" });
  });
});
