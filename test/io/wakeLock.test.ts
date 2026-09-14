import { describe, expect, it, vi } from "vitest";

import {
  createWakeLock,
  type WakeLockNavigatorLike,
} from "../../src/io/wakeLock";

// Roadmap 13.1, brief E8, the FIRST code slice of the session-survival
// kit (decisions/ADR-0007-session-survival.md). The Screen Wake Lock is
// requested when a session starts and re-requested when the tab becomes
// visible again, because the lock drops on tab-hide by specification.
// This is a laptop need as much as a phone one: the 260-second light
// protocol (14.10, 14.11) outlasts a laptop's idle timer too.
//
// The wrapper is impure by definition — it touches navigator.wakeLock —
// so it lives in io and is driven here against a FAKE navigator, exactly
// as negotiateFrameRate is driven against a fake track. A browser that
// exposes no wakeLock (an older iPhone Safari) and a browser that
// REFUSES the request each has a defined behaviour, and a refusal is
// recorded, never thrown, on the metadata-step precedent row 13.2 set.

type ReleaseListener = () => void;

function fakeSentinel(): {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: ReleaseListener) => void;
  fireRelease: () => void;
} {
  let listener: ReleaseListener | null = null;
  return {
    release: () => Promise.resolve(),
    addEventListener: (_type, l) => {
      listener = l;
    },
    fireRelease: () => listener?.(),
  };
}

describe("the wake-lock wrapper (roadmap 13.1)", () => {
  it("requests a screen wake lock when the browser supports it", async () => {
    const sentinel = fakeSentinel();
    const request = vi.fn(() => Promise.resolve(sentinel));
    const nav: WakeLockNavigatorLike = { wakeLock: { request } };

    const lock = createWakeLock(nav);
    await lock.ensure();

    expect(request).toHaveBeenCalledWith("screen");
    expect(lock.outcome()).toEqual({
      supported: true,
      acquired: true,
      reacquisitions: 0,
      lastError: null,
    });
  });

  it("records an unsupported browser rather than throwing at it", async () => {
    // An iPhone Safari with no Screen Wake Lock API must not lose its
    // session over a feature it never had: supported is false, nothing
    // is requested, and nothing propagates.
    const nav: WakeLockNavigatorLike = {};
    const lock = createWakeLock(nav);

    await expect(lock.ensure()).resolves.toBeUndefined();
    expect(lock.outcome()).toEqual({
      supported: false,
      acquired: false,
      reacquisitions: 0,
      lastError: null,
    });
  });

  it("records a refusing browser rather than throwing at it", async () => {
    // A tab denied the lock (a permissions policy, a background tab) is
    // a session worth keeping without the screen guarantee: the record
    // says why and the ask can be tried again on the next visibility.
    const request = vi.fn(() =>
      Promise.reject(new Error("wake lock request denied")),
    );
    const nav: WakeLockNavigatorLike = { wakeLock: { request } };

    const lock = createWakeLock(nav);
    await expect(lock.ensure()).resolves.toBeUndefined();

    const outcome = lock.outcome();
    expect(outcome.supported).toBe(true);
    expect(outcome.acquired).toBe(false);
    expect(outcome.lastError).toBe("wake lock request denied");
  });

  it("does not re-request while a live lock is already held", async () => {
    const request = vi.fn(() => Promise.resolve(fakeSentinel()));
    const nav: WakeLockNavigatorLike = { wakeLock: { request } };

    const lock = createWakeLock(nav);
    await lock.ensure();
    await lock.ensure();

    expect(request).toHaveBeenCalledTimes(1);
    expect(lock.outcome().reacquisitions).toBe(0);
  });

  it("re-acquires after the browser drops the lock on tab-hide", async () => {
    // The lock releases itself when the tab is hidden; the next
    // ensure() — driven by main.ts's visibilitychange handler when the
    // tab is visible again — must ask for a fresh one, and the count of
    // re-acquisitions rides the record.
    const first = fakeSentinel();
    const second = fakeSentinel();
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const nav: WakeLockNavigatorLike = { wakeLock: { request } };

    const lock = createWakeLock(nav);
    await lock.ensure();
    first.fireRelease();
    await lock.ensure();

    expect(request).toHaveBeenCalledTimes(2);
    expect(lock.outcome()).toEqual({
      supported: true,
      acquired: true,
      reacquisitions: 1,
      lastError: null,
    });
  });

  it("releases the held lock and can be re-acquired afterwards", async () => {
    const first = fakeSentinel();
    const release = vi.spyOn(first, "release");
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(fakeSentinel());
    const nav: WakeLockNavigatorLike = { wakeLock: { request } };

    const lock = createWakeLock(nav);
    await lock.ensure();
    await lock.release();
    await lock.ensure();

    expect(release).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
    // A manual release is not a browser drop: the re-acquire after it is
    // the first real re-acquisition, counted once.
    expect(lock.outcome().reacquisitions).toBe(1);
  });

  it("survives release() when no lock is held", async () => {
    const nav: WakeLockNavigatorLike = {};
    const lock = createWakeLock(nav);
    await expect(lock.release()).resolves.toBeUndefined();
  });
});
