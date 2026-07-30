import { LANDMARK_COUNT } from "./constants";

// Defends the trust boundary with the model. An older model variant
// returns 468 landmarks without the iris points, and without this
// guard the iris code would not crash, it would silently measure
// nothing, which is worse.
export type LandmarkValidation =
  { kind: "valid" } | { kind: "wrongCount"; got: number; expected: number };

export function validateLandmarkCount(count: number): LandmarkValidation {
  return count === LANDMARK_COUNT
    ? { kind: "valid" }
    : { kind: "wrongCount", got: count, expected: LANDMARK_COUNT };
}

export function landmarkValidationMessage(
  validation: LandmarkValidation,
): string {
  switch (validation.kind) {
    case "valid":
      return "";
    case "wrongCount":
      return `The face model returned ${String(validation.got)} landmarks instead of ${String(validation.expected)}. This model variant lacks the iris points that measurements need, so measurement is stopped. Reload the page; if this persists, the bundled model file is wrong.`;
  }
}
