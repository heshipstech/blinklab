import type { LuminanceField } from "./pupil";

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
