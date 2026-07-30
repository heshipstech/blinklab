export function pickPoints<T>(
  items: readonly T[],
  indices: readonly number[],
): T[] {
  const picked: T[] = [];
  for (const index of indices) {
    const item = items[index];
    if (item !== undefined) {
      picked.push(item);
    }
  }
  return picked;
}
