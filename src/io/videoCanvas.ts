import type { Point2 } from "../core/geometry";
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

// Points arrive already projected into canvas pixels. This function
// only paints, it makes no coordinate decisions.
export function drawDots(
  context: CanvasRenderingContext2D,
  points: readonly Point2[],
  radiusPx: number,
  color: string,
): void {
  context.fillStyle = color;
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
    context.fill();
  }
}
