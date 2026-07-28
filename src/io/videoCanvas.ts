export function drawVideoFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
): void {
  context.drawImage(video, 0, 0, context.canvas.width, context.canvas.height);
}
