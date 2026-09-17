import type { FeatureRecord } from "./featureRecord";
import type { Point2 } from "./geometry";
import { RECORD_PERIOD_MS } from "./recordGate";
import { SCORE_WINDOW_MS, scoreRecords } from "./score";
import { sparklineSegments, type TimedSample } from "./sparkline";

// Roadmap 14.1: the session event timeline strip, the pure half.
// Blinks, closures, alerts and the score over the WHOLE session, so
// the podium view (14.2), the report card (14.4) and the tour (14.5)
// draw one account of what happened and when. The blink lane reads
// the blink log's own moments and the alert lane reads the fire log
// at the wiring; the two things only this module can supply are the
// closure moments, recovered below from the per-second record, and
// the score as a SERIES rather than the panel's single number.
//
// Two rules carry the row's Check, and both are inherited rather
// than invented:
//
// - A null second draws as a GAP, never as a zero. That is
//   sparkline.ts's own contract for TimedSample, and the strip maps
//   through the same segment builder rather than through a second
//   mapper that could disagree with it.
//
// - A gap is never BRIDGED. The segment builder splits on null
//   SAMPLES, but a paused tab writes no samples at all
//   (recordGate.ts holds rows to delivered frames), so two confident
//   rows an hour apart would join into one confident line across the
//   hour. Samples further apart than the bridge bound get a null
//   sentinel between them first, and the proven splitter does the
//   rest.

// The bound a sample pair must stay under to draw as one line. Two
// record periods: the cadence is "about one row per second"
// (featureRecord.ts), so one missing beat is jitter under load and
// two is a pause. Derived from the record gate's own period rather
// than restated beside it, the aliasing rule every bound in this
// repository follows.
export const TIMELINE_MAX_BRIDGE_MS = 2 * RECORD_PERIOD_MS;

// The strip's horizontal ruler: the session's own span, start to end
// — or to now, while it runs. Not a rolling window; the point of the
// strip is that the beginning stays visible.
export type TimelineSpan = { startMs: number; endMs: number };

// Where event ticks draw. Events outside the span are DROPPED, never
// clamped: a tick pinned to the edge for an event that happened
// elsewhere reads as an event at the edge, which is a lie about time
// on an instrument whose one axis is time. An empty or backwards
// span draws nothing, for the same reason ongoingClosureMs answers
// null rather than inventing a number.
export function timelineTickXs(
  timesMs: readonly number[],
  span: TimelineSpan,
  widthPx: number,
): number[] {
  const spanMs = span.endMs - span.startMs;
  if (spanMs <= 0) {
    return [];
  }
  return timesMs
    .filter((atMs) => atMs >= span.startMs && atMs <= span.endMs)
    .map((atMs) => ((atMs - span.startMs) / spanMs) * widthPx);
}

// Long closures as moments, recovered from the per-second record's
// own cumulative count rather than from a second event stream nobody
// keeps. A rise between two retained rows is that many events inside
// that second, drawn at the row that witnessed the rise. The first
// retained row contributes nothing on purpose: with the buffer's
// oldest rows dropped (FEATURE_RECORD_CAP), a count already standing
// at N says N closures happened SOMETIME before the window — events
// with no moment — and an unwitnessed event is not drawn at a
// made-up x.
export function closureTimesMs(records: readonly FeatureRecord[]): number[] {
  const times: number[] = [];
  let previous: FeatureRecord | undefined;
  for (const record of records) {
    if (previous !== undefined) {
      const rose = record.longClosureCount - previous.longClosureCount;
      for (let each = 0; each < rose; each += 1) {
        times.push(record.timestampMs);
      }
    }
    previous = record;
  }
  return times;
}

// The score at every row, not only the newest: the same scoreRecords
// the panel reads, handed exactly the rows its own window
// (SCORE_WINDOW_MS, filtered from the newest row backwards) would
// keep, so the series' last sample IS the panel's number and the two
// can never disagree. The sliding window keeps this linear: each row
// enters and leaves it once, however long the session ran. Null
// wherever the scorer refuses — no face on the newest row, or
// PERCLOS not yet born — which the strip draws as a gap, never as a
// zero.
export function timelineScoreSamples(
  records: readonly FeatureRecord[],
): TimedSample[] {
  const samples: TimedSample[] = [];
  const window: FeatureRecord[] = [];
  for (const newest of records) {
    window.push(newest);
    let oldest = window[0];
    while (
      oldest !== undefined &&
      oldest.timestampMs < newest.timestampMs - SCORE_WINDOW_MS
    ) {
      window.shift();
      oldest = window[0];
    }
    const breakdown = scoreRecords(window);
    samples.push({
      timestampMs: newest.timestampMs,
      value: breakdown === null ? null : breakdown.score,
    });
  }
  return samples;
}

// The bridge rule, applied by construction rather than checked after
// the fact: a pair of samples further apart than the bound gets a
// null sentinel between them, so the segment builder — which splits
// on null and only null — cannot draw across the pause however
// confident both sides look. The sentinel sits at the midpoint,
// inside the span whenever its neighbours are. Exactly AT the bound
// still draws as one line, the house boundary convention.
export function withGapsMarked(
  samples: readonly TimedSample[],
  maxBridgeMs: number,
): TimedSample[] {
  const marked: TimedSample[] = [];
  let previous: TimedSample | undefined;
  for (const sample of samples) {
    if (
      previous !== undefined &&
      sample.timestampMs - previous.timestampMs > maxBridgeMs
    ) {
      marked.push({
        timestampMs: (previous.timestampMs + sample.timestampMs) / 2,
        value: null,
      });
    }
    marked.push(sample);
    previous = sample;
  }
  return marked;
}

// The score's polyline over the session span, through the sparkline's
// own proven mapper: a strip span is a window whose left edge is the
// session start, so the geometry is the same function with the same
// null splits, plus the bridge rule above. 100 is the score's own
// ceiling — score.ts's four penalty caps sum to exactly 100, so the
// axis is the score's whole range and a resting 100 draws at the top.
export function timelineScoreSegments(
  samples: readonly TimedSample[],
  span: TimelineSpan,
  widthPx: number,
  heightPx: number,
): Point2[][] {
  const spanMs = span.endMs - span.startMs;
  if (spanMs <= 0) {
    return [];
  }
  return sparklineSegments(
    withGapsMarked(samples, TIMELINE_MAX_BRIDGE_MS),
    span.endMs,
    spanMs,
    widthPx,
    heightPx,
    100,
  );
}
