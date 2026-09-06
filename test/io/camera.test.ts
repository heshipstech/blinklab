import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachStream,
  requestCamera,
  stopCamera,
  stopStream,
} from "../../src/io/camera";

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
