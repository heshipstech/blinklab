export type CameraFrameSize = {
  widthPx: number;
  heightPx: number;
};

export async function startCamera(
  video: HTMLVideoElement,
  deviceId?: string,
): Promise<CameraFrameSize> {
  const stream = await navigator.mediaDevices.getUserMedia({
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
  video.srcObject = stream;
  await video.play();
  return { widthPx: video.videoWidth, heightPx: video.videoHeight };
}

export function stopCamera(video: HTMLVideoElement): void {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
  video.srcObject = null;
}

export async function listMediaDevices(): Promise<MediaDeviceInfo[]> {
  return navigator.mediaDevices.enumerateDevices();
}
