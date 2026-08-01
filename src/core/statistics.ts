// The coefficient of variation prices the wobble in means: standard
// deviation divided by mean, unit free, so a pixel series and a
// millimetre series can be compared fairly on the same scale.

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

export function standardDeviation(values: readonly number[]): number | null {
  const m = mean(values);
  if (m === null) {
    return null;
  }
  let sumSquared = 0;
  for (const value of values) {
    sumSquared += (value - m) * (value - m);
  }
  return Math.sqrt(sumSquared / values.length);
}

// Nearest rank percentile: the smallest value that is greater than
// or equal to p percent of the samples.
export function percentile(
  values: readonly number[],
  p: number,
): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1] ?? null;
}

export function coefficientOfVariation(
  values: readonly number[],
): number | null {
  const m = mean(values);
  const sd = standardDeviation(values);
  // A mean at or below zero makes the ratio meaningless, refuse it.
  if (m === null || sd === null || m <= 0) {
    return null;
  }
  return sd / m;
}
