// A bounded list for unbounded streams: push forever, memory stays
// fixed, the oldest entries fall off the front.
export function pushBounded<T>(
  items: readonly T[],
  item: T,
  capacity: number,
): T[] {
  const next = [...items, item];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}
