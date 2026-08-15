import type { DeviceInfo } from "../core/sessionMetadata";

// Reading the browser for the conditions of a measurement. Impure by
// definition, so it lives here and hands core a plain object it can
// turn into sentences without a camera present.
//
// One field is deliberately absent: `deviceId`. It is a stable
// per-origin identifier for a specific camera, which makes it a
// fingerprint rather than a measurement, and nothing in the analysis
// needs it. The camera's LABEL is included because "FaceTime HD Camera"
// is the fact worth knowing and it identifies a model, not a person.

function trackOf(video: HTMLVideoElement): MediaStreamTrack | null {
  const stream = video.srcObject;
  if (!(stream instanceof MediaStream)) {
    return null;
  }
  return stream.getVideoTracks()[0] ?? null;
}

/**
 * Everything the browser will tell us about the camera and the machine.
 *
 * Every read is defensive. `getSettings` is not implemented uniformly,
 * `screen.orientation` is absent on older Safari, and `deviceMemory`
 * and friends are Chrome-only. A metadata block is not worth throwing
 * a frame loop for, so anything missing becomes null and prints as
 * "unknown", which is a true statement rather than a gap.
 */
export function readDeviceInfo(video: HTMLVideoElement): DeviceInfo {
  const track = trackOf(video);
  let settings: MediaTrackSettings = {};
  let label: string | null = null;
  if (track !== null) {
    label = track.label.length > 0 ? track.label : null;
    try {
      settings = track.getSettings();
    } catch {
      settings = {};
    }
  }

  const orientation = (() => {
    try {
      return window.screen.orientation?.type ?? null;
    } catch {
      return null;
    }
  })();

  return {
    cameraLabel: label,
    cameraWidthPx: settings.width ?? null,
    cameraHeightPx: settings.height ?? null,
    cameraDeclaredFps:
      settings.frameRate === undefined
        ? null
        : Math.round(settings.frameRate * 100) / 100,
    facingMode: settings.facingMode ?? null,
    userAgent: navigator.userAgent.length > 0 ? navigator.userAgent : null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    viewportWidthPx: window.innerWidth,
    viewportHeightPx: window.innerHeight,
    screenWidthPx: window.screen?.width ?? null,
    screenHeightPx: window.screen?.height ?? null,
    devicePixelRatio: window.devicePixelRatio ?? null,
    orientation,
  };
}
