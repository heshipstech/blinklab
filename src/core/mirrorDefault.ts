// The Mirror control's default for a camera, from its facingMode
// (roadmap 13.1, decisions/ADR-0007-session-survival.md).
//
// Mirror is ON by default, which is what a person watching their own
// face expects — a bathroom mirror flips left and right. That is right
// for a front ("user") camera and wrong for an "environment" (rear)
// camera, which frames the world in front of the person: mirroring that
// flips the scene, and any text in it reads backwards. So an environment
// camera defaults Mirror off, the same choice a loaded clip already
// makes (issue #301). An unknown or absent facingMode keeps the
// mirrored default — a camera that reports nothing is usually a laptop
// front camera, and the toggle is always there to change it.
//
// Pure, so the choice is testable without a camera; io reads facingMode
// and main.ts applies this once the track is attached.

/**
 * Whether Mirror should default ON for a camera with this `facingMode`.
 * True for every facing but "environment"; the rear camera alone
 * defaults off.
 */
export function mirrorDefaultForFacingMode(facingMode: string | null): boolean {
  return facingMode !== "environment";
}
