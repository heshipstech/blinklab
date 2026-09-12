// Roadmap 10.7b. The cross-eye disagreement refusal, with its
// threshold DERIVED from the measured distribution rather than
// chosen.
//
// The live aperture has always been the mean of the two eyes, and a
// mean has no opinion about its inputs: when one eye's landmarks
// break — glare on a lens, a lash-occluded corner, a half-turned
// face the pose gate still admits — the wreck and the good eye
// average into a number that looks like a measurement and feeds the
// blink line, the shut line and every millimetre downstream. 10.7a
// measured how much two honest eyes of one face disagree at
// stillness (docs/aperture-noise-floor.txt: median 0.200 mm, p95
// 0.860 mm), which is the first committed number that says where
// disagreement stops being anatomy and starts being damage.
//
// The threshold is twice that p95 — the same clear-it-by-a-factor
// stance 12.0a's adoption margin takes over the per-eye floor —
// because a refusal line at the tail's own edge would refuse one
// honest frame in twenty by construction, and the damage this gate
// exists to catch sits far past the tail: a broken eye disagrees by
// millimetres, not hundredths. A test parses the document and holds
// this constant at or above the measured p95 (the 10.10b pattern),
// so the derivation cannot quietly drift from its source.
//
// This module is on the detector ratchet's watch list from birth —
// the enrolment lesson in LEARNING: a new source is invisible to a
// roster until a person adds it.

/**
 * The measured cross-eye p95 this gate derives from, as
 * docs/aperture-noise-floor.txt committed it on 5 September 2026.
 * Held to the document by test — the constant may sit at or above
 * the parsed p95, never below without a stated reason in the doc.
 */
const CROSS_EYE_P95_MM = 0.86;

/**
 * The most two apertures of one face may disagree and still merge,
 * in millimetres: twice the measured cross-eye p95.
 */
export const CROSS_EYE_DISAGREEMENT_MM = 2 * CROSS_EYE_P95_MM;

/**
 * The two eyes' apertures as one reading, or a refusal.
 *
 * The mean where both eyes are present and agree within the
 * threshold; null past it, because averaging a broken eye with a
 * good one manufactures a plausible number from a wreck. Exactly at
 * the threshold still merges — the house boundary rule, the same
 * convention the blink arm and the shut line keep. A missing eye is
 * null-in null-out, exactly as the inline mean this replaces
 * behaved: one eye cannot vouch for itself.
 */
export function mergedApertureMm(
  leftMm: number | null,
  rightMm: number | null,
): number | null {
  if (leftMm === null || rightMm === null) {
    return null;
  }
  if (Math.abs(leftMm - rightMm) > CROSS_EYE_DISAGREEMENT_MM) {
    return null;
  }
  return (leftMm + rightMm) / 2;
}
