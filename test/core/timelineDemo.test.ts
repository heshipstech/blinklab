import { describe, expect, it } from "vitest";

import {
  demoTimelineStory,
  timelineDemoRequested,
} from "../../src/core/timelineDemo";
import { TIMELINE_MAX_BRIDGE_MS } from "../../src/core/timelineStrip";

describe("timelineDemoRequested", () => {
  it("answers the flag and nothing else", () => {
    expect(timelineDemoRequested("?timelineDemo=1")).toBe(true);
    expect(timelineDemoRequested("")).toBe(false);
    expect(timelineDemoRequested("?timelineDemo=0")).toBe(false);
    expect(timelineDemoRequested("?cueTimeScale=1")).toBe(false);
  });
});

describe("demoTimelineStory", () => {
  it("is deterministic, because a test recomputes the page from it", () => {
    expect(demoTimelineStory()).toEqual(demoTimelineStory());
  });

  it("keeps every moment inside its own span, in order", () => {
    const story = demoTimelineStory();
    const moments = [
      ...story.blinkTimesMs,
      ...story.closureTimesMs,
      ...story.alertTimesMs,
      ...story.scoreSamples.map((sample) => sample.timestampMs),
    ];
    for (const atMs of moments) {
      expect(atMs).toBeGreaterThanOrEqual(story.span.startMs);
      expect(atMs).toBeLessThanOrEqual(story.span.endMs);
    }
    let previous = -Infinity;
    for (const sample of story.scoreSamples) {
      expect(sample.timestampMs).toBeGreaterThan(previous);
      previous = sample.timestampMs;
    }
  });

  it("exercises both gap rules, or the e2e would prove less than it reads", () => {
    // The story must contain a null sample (the gap that draws as
    // nothing, never as zero) AND a pause wider than the bridge
    // bound (the gap that must never be bridged); a story without
    // them would let the e2e pass while the strip's two properties
    // went unexercised on the page.
    const story = demoTimelineStory();
    expect(story.scoreSamples.some((sample) => sample.value === null)).toBe(
      true,
    );
    let widestGapMs = 0;
    let previous: number | null = null;
    for (const sample of story.scoreSamples) {
      if (previous !== null) {
        widestGapMs = Math.max(widestGapMs, sample.timestampMs - previous);
      }
      previous = sample.timestampMs;
    }
    expect(widestGapMs).toBeGreaterThan(TIMELINE_MAX_BRIDGE_MS);
  });
});
