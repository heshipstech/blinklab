import type { DrawTransform } from "../core/transform";

export function drawVideoFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  transform: DrawTransform,
): void {
  context.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  );
  context.drawImage(video, 0, 0, context.canvas.width, context.canvas.height);
  context.setTransform(1, 0, 0, 1, 0, 0);
}
