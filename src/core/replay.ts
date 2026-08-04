// The replay machinery behind the scanpath slider. A recording is a
// list of timestamps sorted ascending (recorded live, so time order
// is free), and the slider asks one question per scrub: how much of
// the recording had happened by this moment?

// Counts the samples with a timestamp at or before atMs, by binary
// search. Exactly at the moment still counts, the house boundary
// rule. The count doubles as the exclusive end index for drawing:
// samples[0..count) is the visible past.
export function replayIndex(
  timestampsMs: readonly number[],
  atMs: number,
): number {
  let low = 0;
  let high = timestampsMs.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((timestampsMs[mid] ?? Infinity) <= atMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

// Maps the slider's travel fraction onto the recording's time span,
// clamped so an overshooting control never scrubs outside it. A
// single-moment session maps every fraction to that moment.
export function sliderTime(
  startMs: number,
  endMs: number,
  fraction: number,
): number {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return startMs + (endMs - startMs) * clamped;
}
