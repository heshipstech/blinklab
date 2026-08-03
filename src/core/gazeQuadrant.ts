import type { IrisOffset } from "./gazeOffset";

// Gaze into four screen regions, named from the USER's perspective.
// The sign derivation, worth restating because it surprises: looking
// toward the screen's left turns the irises toward the subject's own
// left, which is IMAGE RIGHT in unmirrored measurement space, so
// positive horizontal means screen left. Positive vertical is image
// down, looking down, screen bottom.
//
// No calibration yet: zero-centred boundaries assume neutral gaze
// reads zero. A camera above the screen biases vertical toward
// bottom, known, documented, and 5.4's calibration is the cure.
export type ScreenQuadrant =
  "top left" | "top right" | "bottom left" | "bottom right";

export function meanIrisOffset(
  right: IrisOffset | null,
  left: IrisOffset | null,
): IrisOffset | null {
  if (right === null || left === null) {
    return null;
  }
  return {
    horizontal: (right.horizontal + left.horizontal) / 2,
    vertical: (right.vertical + left.vertical) / 2,
  };
}

export function screenQuadrant(offset: IrisOffset): ScreenQuadrant {
  // Boundary convention: exactly zero counts as left and as bottom.
  const side = offset.horizontal >= 0 ? "left" : "right";
  const band = offset.vertical >= 0 ? "bottom" : "top";
  return `${band} ${side}` as ScreenQuadrant;
}
