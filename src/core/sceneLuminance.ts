import type { Point2 } from "./geometry";
import type { LuminanceField, PixelBox } from "./pupil";

// Roadmap 12.16a. How much light the camera thinks it is seeing, as a
// number, with no adjective attached to it.
//
// THE MEASUREMENT HALF ONLY, and the parking of the other half is the
// point rather than an omission. A webcam applies its own automatic
// exposure and white balance before this project sees a single byte,
// so a bright room and a dim room the camera has compensated for can
// arrive looking alike. What this measures is the camera's RENDERING
// of the light: a real, repeatable quantity about the picture, and not
// a measurement of the room. Nothing here knows what a lux is.
//
// So no threshold, no adjective, no verdict, until something has been
// measured against an outcome. Row 13.6b is where light joins the
// capability ladder and it waits on exactly that. Publishing "too
// dark" from a number nobody has validated would be the shape of claim
// this repository spends its guards preventing.
//
// The io half — which rectangle of which frame — is row 12.16b. This
// side takes a field and returns a number, so it is testable with
// hand-built pixels and needs no camera, which is the seam row 9.3a
// cut along for the pupil and the reason that row was pleasant to
// write.

/**
 * What these numbers are, wherever a person or a file reads them.
 *
 * The wording is load-bearing twice: "camera's rendering" says the
 * quantity is about the picture, and "not lux" says what a reader
 * must not take it for. A test holds both, and holds the label free of
 * any verdict word.
 */
export const LUMINANCE_LABEL =
  "the camera's rendering of light, not lux: a webcam's own exposure " +
  "and white balance act before this is read";

/**
 * The mean luminance of a field, or null when there is no field to
 * average.
 *
 * BLACK IS A MEASUREMENT AND BROKEN IS NOT, and keeping those apart is
 * why this returns null rather than zero on a refusal. A lens cap is a
 * real reading of zero. A crop that went wrong is no reading at all.
 * An export that gave both the same value could not tell a dark room
 * from a dropped frame, and the blank-not-zero rule the rest of the
 * per-second file follows would be broken at its source rather than at
 * the serializer.
 *
 * Refuses a field whose samples do not fill its own grid, because that
 * is what a wrong crop produces and averaging anyway would publish a
 * number for a region nobody read. Refuses a sample outside [0,1] for
 * the same reason: `luminanceField` produces that range by
 * construction, so a value outside it means the field came from
 * somewhere else and the mean would not be a luminance.
 */
export function meanLuminance(field: LuminanceField | null): number | null {
  if (field === null) {
    return null;
  }
  const { samples, width, height } = field;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  if (samples.length !== width * height) {
    return null;
  }
  let sum = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
      return null;
    }
    sum += sample;
  }
  return sum / samples.length;
}

// Roadmap 12.16b, the pure half of the wiring.
//
// ONE THUMBNAIL SERVES BOTH NUMBERS, and that is the design rather
// than an optimisation. Landmarks arrive normalised, so a face
// spanning x from 0.3 to 0.7 covers the same FRACTION of any raster it
// is drawn into, whatever the camera's resolution. So the browser
// downscales the whole frame once, the scene mean is taken over all of
// it, and the face mean is taken over a box inside it.
//
// The alternative was two full-resolution reads. On a 1080p camera
// that is about eight megabytes a second through `getImageData`, into
// a loop the September audit already flagged for drawing more than it
// needs. This is about nine kilobytes, and it buys a second property
// worth more than the bytes: both numbers come from the SAME frame at
// the SAME exposure through the SAME scaling, so the difference
// between them is a fact about the light and not about how they were
// read.

/**
 * The raster the scene is downscaled into before it is read.
 *
 * 64 by 36 is 2304 pixels, about nine kilobytes of RGBA, and the
 * aspect is the common one; a camera of another shape is stretched
 * into it, which does not move a mean. Chosen, not derived: small
 * enough that reading it every second is unnoticeable, and big enough
 * that a face covering a quarter of the frame still lands on 16 by 9
 * pixels rather than on a handful that one bright one could swing.
 */
export const LUMINANCE_THUMBNAIL_WIDTH = 64;
export const LUMINANCE_THUMBNAIL_HEIGHT = 36;

/**
 * Where the face falls inside a raster of this size, from normalised
 * landmarks, or null when it does not fall inside it usefully.
 *
 * Rounds OUTWARD. Rounding in would crop the rim the face was measured
 * by, and on a raster this small that rim is a whole pixel of a face
 * only a few pixels across.
 *
 * Clamps to the raster, because a face at the edge of frame is
 * ordinary rather than an error, and the box simply becomes what is
 * actually there. Refuses a face wholly outside it, a face that rounds
 * away to no area at all — reporting a zero-width box would hand
 * `luminanceField` an empty crop, where null says the true thing, that
 * this raster cannot see the face — and any landmark that is not a
 * finite number.
 */
export function faceBox(
  face: readonly Point2[],
  rasterWidth: number,
  rasterHeight: number,
): PixelBox | null {
  if (
    face.length === 0 ||
    !Number.isFinite(rasterWidth) ||
    !Number.isFinite(rasterHeight) ||
    rasterWidth <= 0 ||
    rasterHeight <= 0
  ) {
    return null;
  }
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const point of face) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  const x0 = Math.max(0, Math.floor(left * rasterWidth));
  const y0 = Math.max(0, Math.floor(top * rasterHeight));
  const x1 = Math.min(rasterWidth, Math.ceil(right * rasterWidth));
  const y1 = Math.min(rasterHeight, Math.ceil(bottom * rasterHeight));
  if (x1 <= x0 || y1 <= y0) {
    return null;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
