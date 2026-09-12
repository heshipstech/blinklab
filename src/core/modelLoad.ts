// The model-load clock, roadmap 13.10.
//
// The page used to wait on the 15.8 MB model download with no clock:
// a download that hung left "Loading the measuring model..." on
// screen forever, a stuck state wearing a healthy idle's clothes,
// with nothing for a visitor to click. This reducer is the rule that
// ends the wait; main.ts drives it once a second while a load is in
// flight and lands a timeout in the same visible modelFailed state a
// download error reaches, retry button and all.
//
// Timeout plus no model is NEVER healthy idle — the row's Check
// clause, held by test. And a model that arrives after the timeout is
// still a model: the failed state records the wait's verdict, not the
// bytes' fate, so a later retry is instant instead of re-fetching.

/**
 * 120 seconds: about twice the slowest stated profile's uncompressed
 * fetch (docs/cold-load.txt — 16.13 MB at 2 Mbps is 64.5 s), so an
 * honest slow load is never killed, and a stalled one becomes visible
 * within two minutes. Derived there, pinned here.
 */
export const MODEL_LOAD_TIMEOUT_MS = 120_000;

export type ModelLoadState =
  | { kind: "idle" }
  | { kind: "loading"; startedAtMs: number }
  | { kind: "ready" }
  | { kind: "failed"; why: "error" | "timeout" };

export const idleModelLoad: ModelLoadState = { kind: "idle" };

/**
 * A load begins. A second start while one is in flight JOINS it —
 * keeping the first clock — because otherwise every retry click
 * pushes the timeout further out and a hung download can be kept
 * "loading" forever by hoping at it. A start after a failure is a
 * genuine retry and restarts the clock.
 */
export function modelLoadStarted(
  state: ModelLoadState,
  nowMs: number,
): ModelLoadState {
  if (state.kind === "loading" || state.kind === "ready") {
    return state;
  }
  return { kind: "loading", startedAtMs: nowMs };
}

/** The download's own answer, whenever it comes. Late success wins
 * over an earlier timeout: the model exists, whatever the wait said. */
export function modelLoadResolved(
  state: ModelLoadState,
  ok: boolean,
): ModelLoadState {
  if (ok) {
    return { kind: "ready" };
  }
  return state.kind === "ready" ? state : { kind: "failed", why: "error" };
}

/**
 * The clock's reading. Fires exactly at the bound: a wait that has
 * lasted the whole timeout has earned its verdict, the same inclusive
 * boundary rule the rest of this repository uses.
 */
export function modelLoadTick(
  state: ModelLoadState,
  nowMs: number,
): ModelLoadState {
  if (state.kind !== "loading") {
    return state;
  }
  return nowMs - state.startedAtMs >= MODEL_LOAD_TIMEOUT_MS
    ? { kind: "failed", why: "timeout" }
    : state;
}
