import type { TimedSample } from "./sparkline";
import type { TimelineSpan } from "./timelineStrip";

// Roadmap 14.1's last clause, the honest shortcut: the Check wants
// the strip proven end to end "via synthetic injected events, never
// a face video", and the e2e suite runs against the production
// build, where no camera and no committed clip can produce a blink.
// So the page takes a query hook on the cued protocol's own pattern
// (cueSchedule.ts's cueTimeScale): a production flag whose effect is
// confessed out loud. With ?timelineDemo=1 the strip paints the
// story below ONCE and a sentence beside it says the data is
// synthetic; session state, exports and every detector are
// untouched, so the shortcut's whole surface is the strip's own
// pixels and the label that disowns them.
export function timelineDemoRequested(search: string): boolean {
  return new URLSearchParams(search).get("timelineDemo") === "1";
}

export type TimelineStory = {
  span: TimelineSpan;
  scoreSamples: TimedSample[];
  blinkTimesMs: number[];
  closureTimesMs: number[];
  alertTimesMs: number[];
};

// Two minutes, written to exercise every rule the strip carries
// rather than to look pretty: ordinary blinking early, the face
// lost for six seconds (null samples — the gap that must never draw
// as zero), a fifteen-second pause with NO samples at all (the gap
// that must never be bridged), then a drowsy decline with two long
// closures and one fired alert. Deterministic by construction — no
// clock, no randomness — so a test can recompute every drawn count
// from this same function and hold the page to it.
export function demoTimelineStory(): TimelineStory {
  const span: TimelineSpan = { startMs: 0, endMs: 120000 };
  const scoreSamples: TimedSample[] = [];
  for (let second = 0; second < 120; second += 1) {
    // The paused stretch: seconds 45 to 59 produce nothing, the way
    // a hidden tab produces nothing (recordGate.ts holds rows to
    // delivered frames).
    if (second >= 45 && second < 60) {
      continue;
    }
    // The lost face: six seconds where the scorer refuses, which
    // draws as a gap and never as a zero.
    if (second >= 30 && second < 36) {
      scoreSamples.push({ timestampMs: second * 1000, value: null });
      continue;
    }
    const value = second < 80 ? 100 : Math.max(60, 92 - (second - 80));
    scoreSamples.push({ timestampMs: second * 1000, value });
  }
  return {
    span,
    scoreSamples,
    // Off the whole-second grid on purpose: real blinks do not land
    // on record boundaries, and neither should the demo's.
    blinkTimesMs: [
      5400, 13400, 21400, 29400, 38400, 42400, 64400, 71400, 78400,
    ],
    closureTimesMs: [83200, 101500],
    alertTimesMs: [83800],
  };
}
