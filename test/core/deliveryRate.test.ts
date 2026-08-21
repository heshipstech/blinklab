import { describe, expect, it } from "vitest";

import {
  DELIVERY_WINDOW_MS,
  deliveryRates,
  emptyDelivery,
  noteDelivered,
  noteRead,
  type DeliveryState,
} from "../../src/core/deliveryRate";

// The rate this instrument has never measured.
//
// `measured_fps` counts model calls, so a session processing at 127 on
// a 30 fps camera reports 127 distinct observations of an eye per
// second when it has 30. `camera_declared_fps` is a claim from
// getSettings and it read 30.0 in all twelve measured sessions
// regardless of what arrived. Neither is the rate that decides whether
// a blink was photographed at all.
//
// This reducer takes the two event streams the page can actually see —
// a frame was delivered, a frame was read — and answers three
// questions: how fast the camera delivered, how many DISTINCT delivered
// frames the detector actually looked at, and what share of what
// arrived was read.

/** Run a session at fixed rates and return the state it ends in. */
function session(
  deliveryHz: number,
  processHz: number,
  seconds: number,
): DeliveryState {
  let state = emptyDelivery();
  const deliveryPeriod = 1000 / deliveryHz;
  const processPeriod = 1000 / processHz;
  let nextDelivery = 0;
  let nextRead = 0;
  const end = seconds * 1000;
  // Interleave the two streams in time order, which is what the page
  // does: a delivery callback and an animation tick race each other.
  while (nextDelivery <= end || nextRead <= end) {
    if (nextDelivery <= nextRead) {
      state = noteDelivered(state, nextDelivery);
      nextDelivery += deliveryPeriod;
    } else {
      state = noteRead(state, nextRead);
      nextRead += processPeriod;
    }
  }
  return state;
}

describe("what the camera delivered, and how much of it was read", () => {
  it("reports the camera's rate, not the page's", () => {
    // The case the whole increment exists for: a fast machine on an
    // ordinary camera. The processing rate says 126.7; the number that
    // decides what could be seen is 30.
    const state = session(30, 126.7, 5);
    const rates = deliveryRates(state, 5000);
    expect(rates.deliveredFps).toBeCloseTo(30, 0);
    expect(rates.sampledFps).toBeCloseTo(30, 0);
  });

  it("a machine slower than the camera reads only some of what arrives", () => {
    // macbookair2's shape: 29.2 processing on a declared 30. Every read
    // is a distinct frame, but frames go by unread, so the read
    // fraction drops below one and the sampled rate follows the
    // machine rather than the camera.
    const state = session(30, 29.2, 5);
    const rates = deliveryRates(state, 5000);
    expect(rates.deliveredFps).toBeCloseTo(30, 0);
    expect(rates.sampledFps).toBeLessThan(30);
    expect(rates.readFraction).not.toBeNull();
    expect(rates.readFraction ?? 1).toBeLessThan(1);
  });

  it("a machine faster than the camera reads everything, and no more", () => {
    // The finding stated as a number: above the delivered rate the read
    // fraction saturates at one. Extra processing cannot read a frame
    // that was never delivered.
    const fast = deliveryRates(session(30, 126.7, 5), 5000);
    const matched = deliveryRates(session(30, 30, 5), 5000);
    expect(fast.readFraction ?? 0).toBeGreaterThan(0.98);
    expect(fast.readFraction ?? 0).toBeLessThanOrEqual(1);
    expect(fast.sampledFps ?? 0).toBeCloseTo(matched.sampledFps ?? 0, 0);
  });

  it("a 60 fps camera is visible as 60, at the same processing rate", () => {
    // The other half: when the camera really does deliver more, this
    // reducer is what shows it, and the page stops crediting the
    // machine for it.
    const rates = deliveryRates(session(60, 60, 5), 5000);
    expect(rates.deliveredFps).toBeCloseTo(60, 0);
    expect(rates.sampledFps).toBeCloseTo(60, 0);
  });

  it("says nothing rather than zero before it has seen enough", () => {
    // The house rule. A browser with no delivery callback produces no
    // delivery events at all, and a session one frame old has no rate
    // yet. Neither is a camera delivering zero frames per second.
    const empty = deliveryRates(emptyDelivery(), 1000);
    expect(empty.deliveredFps).toBeNull();
    expect(empty.sampledFps).toBeNull();
    expect(empty.readFraction).toBeNull();

    const readsOnly = noteRead(noteRead(emptyDelivery(), 0), 33);
    const rates = deliveryRates(readsOnly, 33);
    expect(rates.deliveredFps).toBeNull();
    expect(rates.readFraction).toBeNull();
  });

  it("forgets what is older than the window", () => {
    // Bounded by TIME and not by count, the house rule from the
    // sparkline: a buffer capped by sample count holds a different
    // duration at every frame rate.
    const state = session(30, 60, 20);
    const kept = state.deliveredAtMs.filter(
      (t) => 20_000 - t <= DELIVERY_WINDOW_MS,
    );
    expect(state.deliveredAtMs.length).toBe(kept.length);
    expect(state.deliveredAtMs.length).toBeLessThan(30 * 20);
  });

  it("a camera that stops delivering stops reporting a rate", () => {
    // The PERCLOS lesson, in another module: a window that stops
    // receiving samples does not hold its last answer, it withdraws.
    // A frozen camera behind a running animation loop would otherwise
    // keep publishing the rate it had when it froze.
    const state = session(30, 60, 5);
    const later = deliveryRates(state, 5000 + DELIVERY_WINDOW_MS + 1000);
    expect(later.deliveredFps).toBeNull();
  });
});
