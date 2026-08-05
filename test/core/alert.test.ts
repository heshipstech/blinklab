import { describe, expect, it } from "vitest";

import {
  ALERT_DEBOUNCE_MS,
  ALERT_DISPLAY_MS,
  alertStep,
  alertVisible,
  initialAlertState,
  type AlertState,
} from "../../src/core/alert";

// Walks a list of (time, triggered) pairs and returns the final state
// plus how many steps reported fires=true.
function walk(steps: readonly { atMs: number; triggered: boolean }[]): {
  state: AlertState;
  fires: number;
} {
  let state = initialAlertState;
  let fires = 0;
  for (const step of steps) {
    const result = alertStep(state, step.atMs, step.triggered);
    state = result.state;
    if (result.fires) {
      fires++;
    }
  }
  return { state, fires };
}

describe("alertStep", () => {
  it("fires on the first trigger", () => {
    const result = alertStep(initialAlertState, 1000, true);
    expect(result.fires).toBe(true);
    expect(result.state.firedCount).toBe(1);
    expect(result.state.suppressedCount).toBe(0);
    expect(result.state.lastFiredAtMs).toBe(1000);
  });

  it("does nothing without a trigger", () => {
    const result = alertStep(initialAlertState, 1000, false);
    expect(result.fires).toBe(false);
    expect(result.state).toEqual(initialAlertState);
  });

  it("runs the ladder's check: repeated triggers within the window fire once", () => {
    // Three long closures in quick succession: one alert, two
    // suppressions, the suppressions counted, not silently eaten.
    const { state, fires } = walk([
      { atMs: 1000, triggered: true },
      { atMs: 2500, triggered: true },
      { atMs: 4000, triggered: true },
    ]);
    expect(fires).toBe(1);
    expect(state.firedCount).toBe(1);
    expect(state.suppressedCount).toBe(2);
  });

  it("fires again once the window has fully passed", () => {
    const { state, fires } = walk([
      { atMs: 1000, triggered: true },
      { atMs: 1000 + ALERT_DEBOUNCE_MS + 1, triggered: true },
    ]);
    expect(fires).toBe(2);
    expect(state.firedCount).toBe(2);
    expect(state.suppressedCount).toBe(0);
  });

  it("runs the debounce boundary trio: exactly at the edge is still inside", () => {
    const after = (gapMs: number): boolean =>
      walk([
        { atMs: 1000, triggered: true },
        { atMs: 1000 + gapMs, triggered: true },
      ]).fires === 2;
    expect(after(ALERT_DEBOUNCE_MS - 1)).toBe(false);
    expect(after(ALERT_DEBOUNCE_MS)).toBe(false);
    expect(after(ALERT_DEBOUNCE_MS + 1)).toBe(true);
  });

  it("suppression does not stretch the window", () => {
    // A suppressed trigger must not reset the clock: the window is
    // measured from the last FIRING, or the alert could be silenced
    // forever by triggers arriving faster than the window.
    const { fires } = walk([
      { atMs: 1000, triggered: true },
      { atMs: 5000, triggered: true },
      { atMs: 1000 + ALERT_DEBOUNCE_MS + 1, triggered: true },
    ]);
    expect(fires).toBe(2);
  });

  it("quiet frames between triggers change nothing", () => {
    const { state, fires } = walk([
      { atMs: 1000, triggered: true },
      { atMs: 1100, triggered: false },
      { atMs: 1200, triggered: false },
      { atMs: 2000, triggered: true },
    ]);
    expect(fires).toBe(1);
    expect(state.suppressedCount).toBe(1);
  });
});

describe("alertVisible", () => {
  it("shows nothing before any firing, even on a young clock", () => {
    // The young-clock probe matters: the page clock starts near zero,
    // so an implementation that coerced the null "never fired" state
    // to time zero would show the banner for the first three seconds
    // of every session. Null must mean never, not "fired at zero".
    expect(alertVisible(initialAlertState, 500)).toBe(false);
    expect(alertVisible(initialAlertState, 99999)).toBe(false);
  });

  it("runs the display boundary trio: exactly at the edge still shows", () => {
    const fired = alertStep(initialAlertState, 1000, true).state;
    expect(alertVisible(fired, 1000 + ALERT_DISPLAY_MS - 1)).toBe(true);
    expect(alertVisible(fired, 1000 + ALERT_DISPLAY_MS)).toBe(true);
    expect(alertVisible(fired, 1000 + ALERT_DISPLAY_MS + 1)).toBe(false);
  });
});
