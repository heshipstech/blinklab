// The alert governor. 6.2 detects the event, this decides whether a
// person gets told, and its one job is restraint: an alarm that
// fires on every trigger nags, and a nagging alarm trains its owner
// to ignore it, which the alarm fatigue literature documents in
// hospitals and cockpits alike. So firings are separated by a
// debounce window, and triggers landing inside the window are
// swallowed, but counted: honesty preserved as a number instead of
// silence.

export const ALERT_DEBOUNCE_MS = 5000;

// How long the banner stays up after a firing: long enough to be
// seen, short enough that the page is not permanently shouting.
export const ALERT_DISPLAY_MS = 3000;

export type AlertState = {
  // When the last alert actually fired. The debounce window is
  // measured from here, never from a suppressed trigger, or fast
  // repeating triggers could silence the alert forever.
  lastFiredAtMs: number | null;
  firedCount: number;
  suppressedCount: number;
};

export const initialAlertState: AlertState = {
  lastFiredAtMs: null,
  firedCount: 0,
  suppressedCount: 0,
};

// One decision per frame: may this trigger fire? Exactly at the
// window's edge still counts as inside, the house boundary rule.
export function alertStep(
  state: AlertState,
  nowMs: number,
  triggered: boolean,
): { state: AlertState; fires: boolean } {
  if (!triggered) {
    return { state, fires: false };
  }
  const inWindow =
    state.lastFiredAtMs !== null &&
    nowMs - state.lastFiredAtMs <= ALERT_DEBOUNCE_MS;
  if (inWindow) {
    return {
      state: { ...state, suppressedCount: state.suppressedCount + 1 },
      fires: false,
    };
  }
  return {
    state: {
      ...state,
      lastFiredAtMs: nowMs,
      firedCount: state.firedCount + 1,
    },
    fires: true,
  };
}

export function alertVisible(state: AlertState, nowMs: number): boolean {
  return (
    state.lastFiredAtMs !== null &&
    nowMs - state.lastFiredAtMs <= ALERT_DISPLAY_MS
  );
}
