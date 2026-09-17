import { describe, expect, it } from "vitest";

import type { FeatureRecord } from "../../src/core/featureRecord";
import { scoreRecords } from "../../src/core/score";
import type { Point2 } from "../../src/core/geometry";
import type { TimedSample } from "../../src/core/sparkline";
import {
  TIMELINE_MAX_BRIDGE_MS,
  closureTimesMs,
  timelineScoreSamples,
  timelineScoreSegments,
  timelineTickXs,
  withGapsMarked,
  type TimelineSpan,
} from "../../src/core/timelineStrip";
import { FIXTURES, fixtureRecords } from "../support/verdictFixtures";

// Roadmap 14.1's Check, first clause: property tests from synthetic
// records and the committed fixture — no zero-height points, gaps
// never bridged. The synthetic rows use score.test.ts's template
// shape: alert unless staged otherwise, fields not involved held
// constant.
function rows(overrides: Partial<FeatureRecord>[]): FeatureRecord[] {
  return overrides.map((over, i) => ({
    timestampMs: i * 1000,
    faceDetected: true,
    fps: 60,
    apertureMm: 7,
    baselineMm: 7.2,
    shutBaselineMm: 7.2,
    baselineOverResting: 1.03,
    sceneLum: 0.42,
    faceLum: 0.51,
    blinkRatePerMin: 15,
    lastBlinkDurationMs: 120,
    lastBlinkAmplitudeMm: 4,
    lastBlinkPeakVelocityMmPerS: 100,
    perclos: 0.01,
    longClosureCount: 0,
    fixationCount: 10,
    fixationMedianMs: 300,
    fixating: true,
    onScreen: true,
    pupilDiameterMm: null,
    blinkLineMm: null,
    blinkLineSource: "none",
    shutLineMm: null,
    shutLineSource: "none",
    sampledFps: null,
    inferenceMs: null,
    blinkObservedFraction: 0.95,
    blinkCountingSuspended: false,
    irisOffsetVertical: 0.02,
    faceSeconds: 42,
    ...over,
  }));
}

const WIDTH = 600;
const HEIGHT = 40;

function spanOf(records: readonly { timestampMs: number }[]): TimelineSpan {
  const first = records[0];
  const last = records[records.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("a span needs records");
  }
  return { startMs: first.timestampMs, endMs: last.timestampMs };
}

// The two Check properties, stated once and asked of every series
// this file draws, synthetic and committed alike.
function pointCount(segments: readonly Point2[][]): number {
  return segments.reduce((sum, segment) => sum + segment.length, 0);
}

function assertNeverBridged(
  segments: readonly Point2[][],
  span: TimelineSpan,
): void {
  const spanMs = span.endMs - span.startMs;
  for (const segment of segments) {
    let previous: Point2 | undefined;
    for (const point of segment) {
      if (previous !== undefined) {
        const dtMs = ((point.x - previous.x) / WIDTH) * spanMs;
        expect(dtMs).toBeLessThanOrEqual(TIMELINE_MAX_BRIDGE_MS);
      }
      previous = point;
    }
  }
}

describe("timelineTickXs", () => {
  const span: TimelineSpan = { startMs: 0, endMs: 10000 };

  it("maps event moments proportionally across the span", () => {
    expect(timelineTickXs([0, 2500, 10000], span, 100)).toEqual([0, 25, 100]);
  });

  it("drops events outside the span rather than clamping them", () => {
    expect(timelineTickXs([-1, 10001], span, 100)).toEqual([]);
  });

  it("draws nothing on an empty or backwards span", () => {
    expect(timelineTickXs([5], { startMs: 5, endMs: 5 }, 100)).toEqual([]);
    expect(timelineTickXs([5], { startMs: 9, endMs: 5 }, 100)).toEqual([]);
  });
});

describe("closureTimesMs", () => {
  it("draws a rise at the row that witnessed it", () => {
    const records = rows([
      { longClosureCount: 0 },
      { longClosureCount: 0 },
      { longClosureCount: 1 },
      { longClosureCount: 1 },
      { longClosureCount: 2 },
    ]);
    expect(closureTimesMs(records)).toEqual([2000, 4000]);
  });

  it("draws two ticks when the count rises by two in one second", () => {
    const records = rows([{ longClosureCount: 0 }, { longClosureCount: 2 }]);
    expect(closureTimesMs(records)).toEqual([1000, 1000]);
  });

  it("treats the first retained row as a baseline, not as events", () => {
    // With the record buffer's oldest rows dropped, a count already
    // standing at 3 says three closures happened sometime before the
    // window. An unwitnessed event has no moment and is not drawn.
    const records = rows([
      { longClosureCount: 3 },
      { longClosureCount: 3 },
      { longClosureCount: 3 },
    ]);
    expect(closureTimesMs(records)).toEqual([]);
  });
});

describe("timelineScoreSamples", () => {
  it("agrees with the panel's own scorer at every row", () => {
    // 150 seconds staged through alert, absent, drowsy and back: the
    // sliding window must equal the naive definition — the panel's
    // scoreRecords over everything up to that row — at every single
    // sample, so the strip can never tell a different story than the
    // number beside it.
    const staged = rows(
      Array.from({ length: 150 }, (_, i) => {
        if (i >= 40 && i < 55) {
          return { faceDetected: false, perclos: null };
        }
        if (i >= 80) {
          return { perclos: 0.2, longClosureCount: i >= 120 ? 2 : 1 };
        }
        return {};
      }),
    );
    const samples = timelineScoreSamples(staged);
    expect(samples).toHaveLength(150);
    staged.forEach((record, i) => {
      const naive = scoreRecords(staged.slice(0, i + 1));
      expect(samples[i]).toEqual({
        timestampMs: record.timestampMs,
        value: naive === null ? null : naive.score,
      });
    });
  });

  it("reads null on a no-face second, never zero", () => {
    const staged = rows([{}, {}, { faceDetected: false, perclos: null }, {}]);
    const samples = timelineScoreSamples(staged);
    expect(samples[2]).toEqual({ timestampMs: 2000, value: null });
    expect(samples[1]).toEqual({ timestampMs: 1000, value: 100 });
  });
});

describe("withGapsMarked", () => {
  it("plants a null sentinel inside an over-bound pause", () => {
    const samples: TimedSample[] = [
      { timestampMs: 0, value: 90 },
      { timestampMs: 1000, value: 91 },
      { timestampMs: 601000, value: 92 },
    ];
    const marked = withGapsMarked(samples, TIMELINE_MAX_BRIDGE_MS);
    expect(marked).toHaveLength(4);
    expect(marked[2]).toEqual({ timestampMs: 301000, value: null });
  });

  it("keeps a pair exactly at the bound as one line", () => {
    const samples: TimedSample[] = [
      { timestampMs: 0, value: 90 },
      { timestampMs: TIMELINE_MAX_BRIDGE_MS, value: 91 },
    ];
    expect(withGapsMarked(samples, TIMELINE_MAX_BRIDGE_MS)).toEqual(samples);
  });
});

describe("timelineScoreSegments", () => {
  it("gives a null sample no point and a real zero its bottom-edge point", () => {
    // The distinction the whole strip exists to keep: a zero is a
    // measurement drawn at the bottom edge, a null is an absence
    // drawn as nothing.
    const samples: TimedSample[] = [
      { timestampMs: 0, value: 100 },
      { timestampMs: 1000, value: null },
      { timestampMs: 2000, value: 0 },
    ];
    const span: TimelineSpan = { startMs: 0, endMs: 2000 };
    const segments = timelineScoreSegments(samples, span, WIDTH, HEIGHT);
    expect(segments).toEqual([[{ x: 0, y: 0 }], [{ x: WIDTH, y: HEIGHT }]]);
  });

  it("never draws across a paused tab's silence", () => {
    // A minute of rows, ten minutes of nothing at all — no rows, not
    // null rows — then another minute. Without the bridge rule the
    // two confident stretches would join into one line across the
    // pause.
    const staged = rows(Array.from({ length: 120 }, () => ({}))).map(
      (record, i) => ({
        ...record,
        timestampMs: i < 60 ? i * 1000 : 600000 + i * 1000,
      }),
    );
    const samples = timelineScoreSamples(staged);
    const span = spanOf(staged);
    const segments = timelineScoreSegments(samples, span, WIDTH, HEIGHT);
    assertNeverBridged(segments, span);
    expect(segments.length).toBeGreaterThanOrEqual(2);
  });

  it("draws exactly one point per non-null in-span sample", () => {
    const staged = rows(
      Array.from({ length: 90 }, (_, i) =>
        i % 7 === 3 ? { faceDetected: false, perclos: null } : {},
      ),
    );
    const samples = timelineScoreSamples(staged);
    const segments = timelineScoreSegments(
      samples,
      spanOf(staged),
      WIDTH,
      HEIGHT,
    );
    const nonNull = samples.filter((sample) => sample.value !== null).length;
    expect(pointCount(segments)).toBe(nonNull);
  });

  it("draws nothing on an empty or backwards span", () => {
    const samples: TimedSample[] = [{ timestampMs: 0, value: 90 }];
    expect(
      timelineScoreSegments(samples, { startMs: 0, endMs: 0 }, WIDTH, HEIGHT),
    ).toEqual([]);
  });
});

describe("the committed fixture sessions hold the strip's properties", () => {
  // The Check's second source: the same five synthetic sessions the
  // verdict pin is built from, through the real row builders. Each
  // must satisfy both properties end to end, whatever its shape —
  // the refused session's all-null score included.
  for (const session of FIXTURES) {
    it(`${session.name}: no zero-height points, gaps never bridged`, () => {
      const records = fixtureRecords(session);
      expect(records.length).toBeGreaterThanOrEqual(2);
      const samples = timelineScoreSamples(records);
      const span = spanOf(records);
      const segments = timelineScoreSegments(samples, span, WIDTH, HEIGHT);
      const inSpanNonNull = samples.filter(
        (sample) =>
          sample.value !== null &&
          sample.timestampMs >= span.startMs &&
          sample.timestampMs <= span.endMs,
      ).length;
      expect(pointCount(segments)).toBe(inSpanNonNull);
      assertNeverBridged(segments, span);
      for (const atMs of closureTimesMs(records)) {
        expect(atMs).toBeGreaterThanOrEqual(span.startMs);
        expect(atMs).toBeLessThanOrEqual(span.endMs);
      }
    });
  }
});
