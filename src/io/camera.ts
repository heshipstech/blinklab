export type CameraFrameSize = {
  widthPx: number;
  heightPx: number;
};

/**
 * Ask for the camera and return its stream WITHOUT attaching it.
 *
 * Roadmap 14.0d (audit A5): the request and the attachment used to be
 * one call that set srcObject and played before returning, so a caller
 * whose run had been superseded during the permission prompt learned
 * so only after the stream was live on the element, and had no handle
 * to stop it with. Two steps, with the caller's token check between
 * them: request, decide, then attachStream() or stopStream().
 */
export async function requestCamera(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    // "ideal" is a negotiation: the browser gets as close as the camera
    // allows, so a webcam that tops out at 1280 simply returns 1280 and
    // nothing has to detect that or fall back by hand.
    //
    // Raised from 1280 on 16 August. The iris is this instrument's
    // ruler, and how many pixels it spans across the source frame sets
    // the precision of every millimetre downstream: a session measured
    // at 36 cm had an iris 26 pixels wide in a 1280 frame, so the whole
    // blink threshold lived in about 8 pixels of eyelid travel. More
    // source pixels is the one improvement that needs nothing from the
    // person being measured.
    //
    // HOW MUCH THIS BUYS IS NOT ASSUMED. The face model resizes its own
    // crop to a fixed input, so past some face size the extra pixels are
    // thrown away inside the model. The export now records the iris
    // width in the frame the model actually read, which is how to find
    // out rather than argue about it.
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      ...(deviceId === undefined ? {} : { deviceId: { exact: deviceId } }),
    },
  });
}

/** Put a requested stream on the element and start it. */
export async function attachStream(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<CameraFrameSize> {
  video.srcObject = stream;
  await video.play();
  return { widthPx: video.videoWidth, heightPx: video.videoHeight };
}

/** End every track of a stream, attached or not. */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Whatever the element is showing, if it is a stream.
 *
 * Duck typed rather than `instanceof MediaStream`: the constructor
 * does not exist outside a browser, and the io tests run in Node with
 * a fake element. A file source sets `src`, never `srcObject`, so
 * anything here with tracks is the camera's.
 */
export function streamOf(video: HTMLVideoElement): MediaStream | null {
  const candidate = video.srcObject as { getTracks?: unknown } | null;
  if (candidate === null || typeof candidate.getTracks !== "function") {
    return null;
  }
  return candidate as MediaStream;
}

export function stopCamera(video: HTMLVideoElement): void {
  const stream = streamOf(video);
  if (stream !== null) {
    stopStream(stream);
  }
  video.srcObject = null;
}

export async function listMediaDevices(): Promise<MediaDeviceInfo[]> {
  return navigator.mediaDevices.enumerateDevices();
}
