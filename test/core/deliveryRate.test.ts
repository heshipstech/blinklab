import { describe, expect, it } from "vitest";

import {
  DELIVERY_WINDOW_MS,
  deliveryRates,
  deliveryStaleness,
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

describe("the two rates are measured over one span (roadmap 10.16, A27)", () => {
  // The audit's finding: the delivered rate was measured between the
  // first and last DELIVERED frame in the window, and the sampled rate
  // between the first and last READ. Two spans, printed as a
  // part-of-whole — "3 frames per second, of which this instrument
  // read 5" — which is not a sentence about anything. Both are
  // measured over the reads' span now, counting the frames that
  // arrived inside it, so the smaller number cannot exceed the larger.
  it("never reports reading more frames than arrived", () => {
    for (const deliveryHz of [15, 24, 30, 60, 120]) {
      for (const processHz of [7.5, 14.3, 29.2, 30, 61, 126.7]) {
        const rates = deliveryRates(session(deliveryHz, processHz, 5), 5000);
        if (rates.deliveredFps === null || rates.sampledFps === null) {
          continue;
        }
        expect(
          rates.sampledFps,
          `${String(processHz)} Hz reading a ${String(deliveryHz)} Hz camera`,
        ).toBeLessThanOrEqual(rates.deliveredFps);
        expect(rates.readFraction ?? 0).toBeLessThanOrEqual(1);
      }
    }
  });

  it("does not read 30 out of 10 when the camera sped up mid-window", () => {
    // The defect, staged. Twenty frames arrive at 10 Hz, then the
    // camera settles at 30 and the page starts reading. Measured over
    // two spans, the delivered rate is the whole window's average, 9.9,
    // and the sampled rate is the last second's, 30. The page then
    // printed "10 frames per second, of which this instrument read 30".
    let state = emptyDelivery();
    for (let i = 0; i < 20; i += 1) {
      state = noteDelivered(state, i * 100);
    }
    for (let i = 0; i < 30; i += 1) {
      const atMs = 4000 + i * (1000 / 30);
      state = noteDelivered(state, atMs);
      state = noteRead(state, atMs);
    }
    const rates = deliveryRates(state, 5000);
    expect(rates.deliveredFps).not.toBeNull();
    expect(rates.sampledFps).not.toBeNull();
    expect(rates.sampledFps ?? 0).toBeLessThanOrEqual(rates.deliveredFps ?? 0);
    expect(rates.deliveredFps).toBeCloseTo(30, 0);
  });

  it("holds at exactly one when every delivered frame is read", () => {
    const rates = deliveryRates(session(30, 126.7, 5), 5000);
    expect(rates.readFraction).toBe(1);
    expect(rates.sampledFps).toBe(rates.deliveredFps);
  });

  it("still reports a delivered rate before the detector has run", () => {
    // A camera delivering into a page whose loop has not ticked yet.
    // There is no comparison to get wrong, so the delivered rate is
    // measured over its own frames and the sampled rate says nothing.
    let state = emptyDelivery();
    for (let i = 0; i < 60; i += 1) {
      state = noteDelivered(state, i * (1000 / 30));
    }
    const rates = deliveryRates(state, 2000);
    expect(rates.deliveredFps).toBeCloseTo(30, 0);
    expect(rates.sampledFps).toBeNull();
    expect(rates.readFraction).toBeNull();
  });
});

describe("a camera that stops delivering, told apart from one never observed", () => {
  // Roadmap 14.0d (audit A26). Before this, a frozen camera and a
  // browser without the delivery callback produced the same null
  // rate, and the page rendered both as the browser's silence. The
  // difference is a fact the state can hold: whether a frame was EVER
  // delivered, and when the last one came.
  it("names how long it has been since the last frame once the window drains", () => {
    const state = session(30, 60, 5);
    // Inside the window nothing is stale, whatever the rate.
    expect(deliveryStaleness(state, 5000)).toBeNull();
    // Past it, the age of the last frame, so the page can say "no
    // frames in the last 5 s" and the frame handler can end the
    // session by name.
    const stale = deliveryStaleness(state, 5000 + DELIVERY_WINDOW_MS + 1000);
    expect(stale).not.toBeNull();
    expect(stale ?? 0).toBeGreaterThanOrEqual(DELIVERY_WINDOW_MS);
  });

  it("is never stale before a first frame was delivered", () => {
    // A browser without the callback, or a session a frame old, has
    // not STOPPED delivering; there was never a frame to stop after.
    // Null-never-zero in another shape: "stale for 60 s" would claim
    // a camera that once worked.
    expect(deliveryStaleness(emptyDelivery(), 60_000)).toBeNull();
    const readsOnly = noteRead(emptyDelivery(), 10_000);
    expect(deliveryStaleness(readsOnly, 60_000)).toBeNull();
  });

  it("a camera that never delivered to an attentive page is stale after a window", () => {
    // The observer is watching, the page has been visible for longer
    // than a window, and not one frame came: that is a camera that
    // stopped before it started, measured from the moment the page
    // could have received one. A row must not wait forever for it.
    const state = noteRead(emptyDelivery(), 100);
    const startedAt = 0;
    expect(deliveryStaleness(state, DELIVERY_WINDOW_MS, startedAt)).toBeNull();
    expect(deliveryStaleness(state, DELIVERY_WINDOW_MS + 1, startedAt)).toBe(
      DELIVERY_WINDOW_MS + 1,
    );
  });

  it("a tab that just came back is not a camera that stopped", () => {
    // A hidden tab receives no delivery callbacks. On return, the
    // silence is the tab's, already counted as an interruption, and
    // the session must not end for it. Only once the page has been
    // attentive for a whole window does silence mean the camera.
    const state = noteDelivered(emptyDelivery(), 1000);
    const returnedAt = 60_000;
    expect(deliveryStaleness(state, returnedAt + 100, returnedAt)).toBeNull();
    expect(
      deliveryStaleness(state, returnedAt + DELIVERY_WINDOW_MS, returnedAt),
    ).toBeNull();
    expect(
      deliveryStaleness(state, returnedAt + DELIVERY_WINDOW_MS + 1, returnedAt),
    ).not.toBeNull();
  });

  it("the last frame's moment survives the window trimming", () => {
    // The rolling window forgets timestamps older than five seconds;
    // the moment of the last frame must not be forgotten with them,
    // or staleness could never exceed the window it is measured
    // against.
    let state = noteDelivered(emptyDelivery(), 1000);
    state = noteRead(state, 1000 + DELIVERY_WINDOW_MS + 5000);
    expect(state.deliveredAtMs).toHaveLength(0);
    expect(deliveryStaleness(state, 1000 + DELIVERY_WINDOW_MS + 5000)).toBe(
      DELIVERY_WINDOW_MS + 5000,
    );
  });
});
