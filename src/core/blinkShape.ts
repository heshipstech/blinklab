// The blink as a shape. Amplitude is how far the lid fell from its
// pre closure maximum to the minimum. Peak closing velocity is the
// fastest adjacent-sample drop on that descent, in mm per second so
// frame rate cannot silently rescale it. Their ratio, amplitude over
// velocity, is a time constant that grows with drowsiness: tired
// lids lose speed before they lose travel.
//
// THE FRAME RATE STILL RESCALES BOTH, and the unit does not save it.
// Roadmap 10.10c4b, ladder B12, measured in
// docs/velocity-sampling-bias.txt. "Fastest adjacent-sample drop" is
// one forward finite difference, which measures the average speed
// over an interval containing the fastest instant rather than the
// instant itself. A blink's closing phase is 50 to 120 milliseconds
// and the interval at 25 frames per second is 40, so the interval is
// the same order as the descent.
//
// Simulated over a raised-cosine descent with a known peak: at 25
// frames per second a 50 ms closure reads 36.8 percent low at the
// median sampling phase and 60.2 percent low at the worst; at 30 fps,
// 28.4 and 52.3. Longer closures fare better and 60 fps fares much
// better. The published velocity is therefore a FLOOR on the true
// one, never a ceiling, at every rate and every phase.
//
// The ratio inherits it inverted. Amplitude survives sampling almost
// intact while velocity is divided into it, so amplitude over
// velocity reads LONGER than the truth by about 1/(1 - bias): up to
// 1.58 times at 25 fps on a short blink. Drowsiness lengthens that
// ratio and so does a slow computer, by a comparable amount, which is
// why two people on different machines cannot be compared on it.
//
// Not corrected here. A correction needs a descent model fitted to
// real lids rather than one chosen for its analytic peak.
export type BlinkShape = {
  amplitudeMm: number;
  peakClosingVelocityMmPerS: number;
  amplitudeOverVelocityMs: number;
};

export type ApertureSample = {
  timestampMs: number;
  apertureMm: number;
};

// How much history before the closure the shape window may include,
// so the pre-blink peak is inside it.
export const SHAPE_LEAD_IN_MS = 400;

/**
 * Where the shape window for a blink that just ended may begin.
 *
 * The window is the closure plus a lead-in. Unclipped, that lead-in
 * reaches back over the PREVIOUS blink whenever two blinks land
 * close together, and analyzeClosing then finds the earlier, deeper
 * descent: the audit measured a second blink published with its
 * predecessor's peak velocity, three times too fast, from a window
 * that was supposed to describe "the descent that just ended". The
 * clip at the previous blink's reopen time is the fix, remediation
 * B4. The clip covers every COUNTED blink; a closure the reducer
 * refused (refractory, over-length) leaves no end time behind, so a
 * window opening after one can still see it, as before this fix.
 * Contamination lived in the gap band where the two blinks are
 * far enough apart to both count and close enough for the windows
 * to overlap, which ordinary blinking visits routinely.
 */
export function shapeWindowStartMs(
  reopenAtMs: number,
  durationMs: number,
  previousBlinkEndMs: number | null,
): number {
  const leadInStartMs = reopenAtMs - durationMs - SHAPE_LEAD_IN_MS;
  return previousBlinkEndMs === null
    ? leadInStartMs
    : Math.max(leadInStartMs, previousBlinkEndMs);
}

export function analyzeClosing(
  samples: readonly ApertureSample[],
): BlinkShape | null {
  if (samples.length < 2) {
    return null;
  }

  let minIdx = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i]?.apertureMm ?? 0) < (samples[minIdx]?.apertureMm ?? 0)) {
      minIdx = i;
    }
  }
  if (minIdx === 0) {
    return null;
  }

  let maxIdx = 0;
  for (let i = 1; i <= minIdx; i++) {
    if ((samples[i]?.apertureMm ?? 0) > (samples[maxIdx]?.apertureMm ?? 0)) {
      maxIdx = i;
    }
  }

  const maxSample = samples[maxIdx];
  const minSample = samples[minIdx];
  if (maxSample === undefined || minSample === undefined) {
    return null;
  }
  const amplitudeMm = maxSample.apertureMm - minSample.apertureMm;
  if (amplitudeMm <= 0) {
    return null;
  }

  let peakMmPerS = 0;
  for (let i = maxIdx; i < minIdx; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (a === undefined || b === undefined) {
      return null;
    }
    const dtS = (b.timestampMs - a.timestampMs) / 1000;
    if (dtS <= 0) {
      return null;
    }
    peakMmPerS = Math.max(peakMmPerS, (a.apertureMm - b.apertureMm) / dtS);
  }
  if (peakMmPerS <= 0) {
    return null;
  }

  return {
    amplitudeMm,
    peakClosingVelocityMmPerS: peakMmPerS,
    amplitudeOverVelocityMs: (amplitudeMm / peakMmPerS) * 1000,
  };
}
