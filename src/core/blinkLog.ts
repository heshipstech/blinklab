import type { BlinkShape } from "./blinkShape";
import { BLINK_LOG_CAP } from "./constants";
import { pushBounded } from "./ringBuffer";

// The durable record of Phase 4: each completed blink as an event,
// when it ended, how long it lasted, and what shape it had.
export type BlinkEvent = {
  atMs: number;
  durationMs: number;
  shape: BlinkShape | null;
};

export function appendEvent(
  events: readonly BlinkEvent[],
  event: BlinkEvent,
): BlinkEvent[] {
  return pushBounded(events, event, BLINK_LOG_CAP);
}

export function formatBlinkEvent(
  event: BlinkEvent,
  sessionStartMs: number,
): string {
  const relativeS = ((event.atMs - sessionStartMs) / 1000).toFixed(1);
  const shapeText =
    event.shape === null
      ? "shape unavailable"
      : `${event.shape.amplitudeMm.toFixed(1)} mm at ${event.shape.peakClosingVelocityMmPerS.toFixed(0)} mm/s, A/V ${event.shape.amplitudeOverVelocityMs.toFixed(0)} ms`;
  return `${relativeS} s, ${event.durationMs.toFixed(0)} ms, ${shapeText}`;
}
