import { BASELINE_OVER_RESTING_CEILING } from "./rulerFit";

// Roadmap 12.7. The aperture already travels in millimetres, and the
// frozen shut baseline beside it (shutBaselineMm) is the open-eye
// ruler the shut line is placed from. Their ratio is a plain
// instrument: how open the lid sits right now as a fraction of that
// frozen baseline. One near 1 is a lid as open as the baseline said it
// was; the instrument reads a fully shut eye at roughly a third, so a
// closing lid walks the ratio down toward there.
//
// EXPORT AND PANEL ONLY, and NOT a verdict. Whether this ratio tracks
// drowsiness, alertness or fatigue is a question no data this project
// may use has answered, and 12.18 is the row that would earn the word.
// claimGuard carries the refusal of the interpretive claim over every
// tracked file (tools/claimGuard.mjs), so the honest instrument label
// survives while the pairing that says the thing was found does not.
//
// THE BORN-WRONG-RULER REFUSAL. The ratio is only as trustworthy as
// its denominator, and docs/shut-line-rule.txt (P2) names the failure
// this refuses: a baseline that froze wrong-low. Divide by a baseline
// that is too small and the ratio inflates past what an eyelid can do,
// so a ratio above the plausibility ceiling is refused as null rather
// than published as a number nobody can trust. Null is the answer, not
// a clamped number: a clamped number is a guess wearing a
// measurement's clothes, the null-never-zero rule this project runs on.

/**
 * The most open a lid may plausibly read against its own frozen
 * baseline before the ruler itself is the likelier explanation.
 *
 * A CHOICE, not a derivation, and the same 1.25 the ruler-fit ceiling
 * uses (rulerFit.ts, from the six-person validation round) read from
 * the other direction: there a baseline more than 1.25x the resting
 * eye is too long to trust; here an aperture more than 1.25x the frozen
 * baseline says that baseline froze wrong-low. Imported rather than
 * re-typed so the one ruler-trust tolerance stays in one place, the
 * discipline closureTaxonomy.ts follows for its own imported edge.
 */
export const LID_OPENNESS_MAX_PLAUSIBLE = BASELINE_OVER_RESTING_CEILING;

/**
 * The lid openness ratio, aperture over the frozen shut baseline, or
 * null when the ruler cannot be trusted.
 *
 * Null (never a number) when the frozen baseline is missing or not
 * positive (no ruler, or an impossible one), when the aperture was not
 * measured this frame, or when the ratio exceeds the plausibility
 * ceiling — the born-wrong-ruler refusal above.
 */
export function lidOpennessRatio(
  apertureMm: number | null,
  shutBaselineMm: number | null,
): number | null {
  if (apertureMm === null || shutBaselineMm === null || shutBaselineMm <= 0) {
    return null;
  }
  const ratio = apertureMm / shutBaselineMm;
  if (ratio > LID_OPENNESS_MAX_PLAUSIBLE) {
    return null;
  }
  return ratio;
}

/**
 * The panel readout. A fact and no interpretation: the openness as a
 * percentage of the frozen baseline, or that it could not be measured
 * this frame. The word "lid openness" without a claim about what it
 * means, so claimGuard's family leaves it alone.
 */
export function lidOpennessSentence(ratio: number | null): string {
  if (ratio === null) {
    // The house idiom for a frame with nothing to show, matching the
    // idle string so the line does not jump when a session starts.
    return "Lid openness: no valid measurement";
  }
  return `Lid openness: ${(ratio * 100).toFixed(0)}% of the frozen open baseline`;
}
