export type CameraFrameSize = {
  widthPx: number;
  heightPx: number;
};

export async function startCamera(
  video: HTMLVideoElement,
  deviceId?: string,
): Promise<CameraFrameSize> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // "ideal" is a negotiation: the browser gets as close as the camera allows.
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
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
