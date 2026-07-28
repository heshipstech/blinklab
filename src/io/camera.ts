export type CameraFrameSize = {
  widthPx: number;
  heightPx: number;
};

export async function startCamera(
  video: HTMLVideoElement,
): Promise<CameraFrameSize> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // "ideal" is a negotiation: the browser gets as close as the camera allows.
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.srcObject = stream;
  await video.play();
  return { widthPx: video.videoWidth, heightPx: video.videoHeight };
}
