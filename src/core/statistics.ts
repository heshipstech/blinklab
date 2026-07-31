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
