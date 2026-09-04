import type { Point2 } from "../core/geometry";
import type { PixelBox } from "../core/pupil";
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

// Strokes an open path through already projected points.
export function drawPolyline(
  context: CanvasRenderingContext2D,
  points: readonly Point2[],
  lineWidthPx: number,
  color: string,
): void {
  const first = points[0];
  if (first === undefined) {
    return;
  }
  context.strokeStyle = color;
  context.lineWidth = lineWidthPx;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.stroke();
}

// Strokes a closed path through already projected points.
// Like drawDots, it only paints, it makes no coordinate decisions.

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

/**
 * Draw the circle that best fits a ring of boundary points.
 *
 * MediaPipe reports the iris as FOUR points on its boundary, and
 * joining four points draws a diamond. That diamond was never a design
 * choice, it was the polygon showing through, and it misrepresents what
 * is being measured: the iris is a circle, and this project uses its
 * diameter as a physical ruler because a real iris is close to 11.7 mm
 * across in almost everyone.
 *
 * The radius is the mean distance from the centre to the boundary
 * points, which is the same average the millimetre conversion is built
 * on. So the circle drawn here is literally the measurement, rather
 * than a decoration next to it.
 */
export function drawFittedCircle(
  context: CanvasRenderingContext2D,
  center: Point2,
  boundary: readonly Point2[],
  lineWidthPx: number,
  color: string,
): void {
  if (boundary.length === 0) {
    return;
  }
  const radius =
    boundary.reduce(
      (total, point) =>
        total + Math.hypot(point.x - center.x, point.y - center.y),
      0,
    ) / boundary.length;
  if (!Number.isFinite(radius) || radius <= 0) {
    return;
  }
  context.strokeStyle = color;
  context.lineWidth = lineWidthPx;
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
  context.stroke();
}

// Read the raw pixels of a region of the video from a CLEAN, full-resolution
// copy. The visible canvas is mirrored, downscaled to fit the page, and may
// carry the landmark overlays drawn on top of the frame; none of that is what
// the pupil estimator should see. So this draws the untouched video to its
// own (offscreen) context at the camera's source resolution, unmirrored, and
// reads back just the requested box. Returns null when the video has no frame
// yet, or the box does not fit inside the frame.
export function readVideoPixels(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  box: PixelBox,
): ImageData | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width === 0 || height === 0) {
    return null;
  }
  if (
    box.x < 0 ||
    box.y < 0 ||
    box.width <= 0 ||
    box.height <= 0 ||
    box.x + box.width > width ||
    box.y + box.height > height
  ) {
    return null;
  }
  const canvas = context.canvas;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(video, 0, 0, width, height);
  return context.getImageData(box.x, box.y, box.width, box.height);
}
