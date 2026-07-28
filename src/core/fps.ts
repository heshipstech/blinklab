export function keepRecent(
  timestampsMs: readonly number[],
  nowMs: number,
  windowMs: number,
): number[] {
  return timestampsMs.filter((t) => nowMs - t <= windowMs);
}

export function measureFps(timestampsMs: readonly number[]): number | null {
  if (timestampsMs.length < 2) {
    return null;
  }
  const first = timestampsMs[0];
  const last = timestampsMs[timestampsMs.length - 1];
  if (first === undefined || last === undefined || last <= first) {
    return null;
  }
  return ((timestampsMs.length - 1) * 1000) / (last - first);
}
