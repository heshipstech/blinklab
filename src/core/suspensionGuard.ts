// The suspension guard, queued by docs/miss-trace.txt and built the
// week its absence cost a corpus run.
//
// A stepped clip measured through a suspend and resume produced a
// COMPLETE LOOKING file — every frame counted, coverage perfect —
// with twelve blinks quietly wrong inside it (27122013_153916_cam,
// 55 found against the published 67, 28 August 2026). The page
// already counted visibility changes; nothing read the count during
// a measurement, so the one witness to the interruption sat in the
// export's metadata while the summary promised a clean result.
//
// Stepped mode's whole guarantee is exactness — which frames were
// measured depends on the recording, not the machine — so a run the
// environment interrupted cannot honestly keep that promise, and a
// refusal beats a warning a reader can miss. Watched mode is left
// as it is: it is already honest about being partial and machine
// dependent, and its export carries the visibility count.

/**
 * The refusal for a stepped clip run, or null for an undisturbed one.
 *
 * `changesDuringRun` is the visibility counter's rise between the
 * first seek and the summary. Zero is the only clean answer: the
 * counter only rises, so a negative delta means the baseline was
 * captured wrong, and a guard that shrugs at its own broken input is
 * no guard — it refuses too, wearing the same sentence.
 */
export function suspensionRefusal(changesDuringRun: number): string | null {
  if (changesDuringRun === 0) {
    return null;
  }
  const count = Math.abs(changesDuringRun);
  const times = count === 1 ? "1 time" : `${String(count)} times`;
  return (
    `The page was hidden or the machine slept ${times} while this ` +
    `clip was being measured frame by frame. A suspended measurement ` +
    `can read wrong apertures while looking complete, so this run is ` +
    `refused rather than exported. Keep the window visible and the ` +
    `machine awake, and measure the clip again.`
  );
}
