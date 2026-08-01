// The blink as a shape. Amplitude is how far the lid fell from its
// pre closure maximum to the minimum. Peak closing velocity is the
// fastest adjacent-sample drop on that descent, in mm per second so
// frame rate cannot silently rescale it. Their ratio, amplitude over
// velocity, is a time constant that grows with drowsiness: tired
// lids lose speed before they lose travel.
export type BlinkShape = {
  amplitudeMm: number;
  peakClosingVelocityMmPerS: number;
  amplitudeOverVelocityMs: number;
};

export type ApertureSample = {
  timestampMs: number;
  apertureMm: number;
};

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
