// Keeping the screen awake for the length of a session (roadmap 13.1,
// brief E8; decisions/ADR-0007-session-survival.md, the first slice).
//
// A phone or a laptop dims and locks after an idle timeout, and the
// frame loop stops with it. The 260-second light protocol (14.10,
// 14.11) and any unattended run are exactly the sessions that outlive
// the idle timer. The Screen Wake Lock API asks the device to stay
// awake; by specification the lock DROPS when the tab is hidden, so it
// is re-requested when the tab becomes visible again — that re-request
// is driven from main.ts's visibilitychange handler, which calls
// ensure() whenever the page is visible.
//
// Impure by definition — it touches navigator.wakeLock — so it lives
// here and hands the caller a small controller it can drive without a
// device. Every path is defensive: a browser with no wakeLock (an
// older iPhone Safari) and a browser that refuses the request each has
// a defined behaviour, and a refusal is RECORDED, never thrown, on the
// metadata-step precedent src/core/frameRateNegotiation.ts set — a
// session without the screen guarantee is a session worth keeping.

import type { WakeLockOutcome } from "../core/sessionMetadata";

// The record of what the wake lock did (WakeLockOutcome) is pure data,
// so it lives in core beside the builder that writes it into the export
// — sessionMetadata.ts's wakeLockMetadataRows — the same split
// DeviceInfo keeps from this file's sibling io/deviceInfo.ts. It is
// re-exported here so a caller driving the controller imports the type
// from the module that produces it.
export type { WakeLockOutcome };

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

type WakeLockLike = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
};

export type WakeLockNavigatorLike = {
  wakeLock?: WakeLockLike;
};

export type WakeLockController = {
  /** Take the lock if it is not already held. Idempotent: safe to call
   * on every visibilitychange. Never throws. */
  ensure: () => Promise<void>;
  /** Release the held lock, if any. Never throws. */
  release: () => Promise<void>;
  /** A snapshot of the record so far. */
  outcome: () => WakeLockOutcome;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A wake-lock controller over the given navigator. Creating it takes no
 * lock and reads only whether the API is present; call ensure() to make
 * the first request.
 */
export function createWakeLock(nav: WakeLockNavigatorLike): WakeLockController {
  const api = nav.wakeLock;
  const supported = api !== undefined;
  let acquired = false;
  let reacquisitions = 0;
  let lastError: string | null = null;
  let current: WakeLockSentinelLike | null = null;

  async function ensure(): Promise<void> {
    if (api === undefined || current !== null) {
      return;
    }
    let sentinel: WakeLockSentinelLike;
    try {
      sentinel = await api.request("screen");
    } catch (error) {
      lastError = messageOf(error);
      return;
    }
    current = sentinel;
    if (acquired) {
      reacquisitions += 1;
    } else {
      acquired = true;
    }
    // The browser drops the lock when the tab is hidden; when it does,
    // forget it so the next ensure() takes a fresh one.
    sentinel.addEventListener?.("release", () => {
      if (current === sentinel) {
        current = null;
      }
    });
  }

  async function release(): Promise<void> {
    const held = current;
    if (held === null) {
      return;
    }
    current = null;
    try {
      await held.release();
    } catch {
      // Releasing is best effort; a refusal here changes nothing the
      // person can act on, and the lock is gone from our view either
      // way.
    }
  }

  function outcome(): WakeLockOutcome {
    return { supported, acquired, reacquisitions, lastError };
  }

  return { ensure, release, outcome };
}
