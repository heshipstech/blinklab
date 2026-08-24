import { describe, expect, it } from "vitest";

import {
  initialModelClock,
  rebaseOnNextStamp,
  stampModelClock,
  type ModelClock,
} from "../../src/core/modelClock";

// Issue #221. The face model demands a clock that only ever rises,
// and the page has three clocks to hand it: the wall clock for a
// camera, the wall clock again for a watched clip, and a lifted
// media clock for a stepped clip. The stepped path was the only one
// that lifted, so a clip stepped faster than real time left the
// model's clock in the FUTURE, and the next camera (or watched
// clip) frame handed it a smaller number. MediaPipe throws, the
// throw kills the display loop, the page freezes silently.
//
// This module is one ratchet every model timestamp passes through.
// The number it must never change is the GAP between two stamps of
// one source: the model reads gaps to track a face between frames,
// and feeding it machine speed instead of source time is the
// repeatability defect of issue #174. So the ratchet shifts a
// source's clock by one constant chosen at source start, and
// otherwise passes it through untouched.

function stampAll(
  clock: ModelClock,
  sourceClocks: readonly number[],
): { clock: ModelClock; stamps: (number | null)[] } {
  const stamps: (number | null)[] = [];
  for (const sourceMs of sourceClocks) {
    const result = stampModelClock(clock, sourceMs);
    clock = result.state;
    stamps.push(result.modelClockMs);
  }
  return { clock, stamps };
}

describe("issue #221's own scenario", () => {
  it("a camera after a fast stepped clip gets a rising clock, not a throw", () => {
    // A four minute clip stepped in ninety seconds: media time runs
    // to 240000 while the wall clock only reaches 100000. The last
    // stamp the model saw is then far ahead of the wall clock the
    // camera is about to hand it.
    let clock = rebaseOnNextStamp(initialModelClock);
    const clip = stampAll(clock, [0, 33.3, 66.7, 239966.7, 240000]);
    clock = clip.clock;
    const lastClipStamp = clip.stamps[clip.stamps.length - 1];
    expect(lastClipStamp).not.toBeNull();

    // The camera starts at wall clock 100000, BEHIND the model's
    // clock. Unlifted, this is the frozen page.
    expect(100000).toBeLessThan(lastClipStamp ?? NaN);

    clock = rebaseOnNextStamp(clock);
    const camera = stampAll(clock, [100000, 100016.7, 100033.3]);
    const all = [...clip.stamps, ...camera.stamps];
    for (let i = 1; i < all.length; i += 1) {
      const previous = all[i - 1];
      const current = all[i];
      expect(previous).not.toBeNull();
      expect(current).not.toBeNull();
      expect(current ?? NaN).toBeGreaterThan(previous ?? NaN);
    }
  });

  it("the watched-clip path has the same disease and the same cure", () => {
    // The issue names the camera, but a WATCHED clip also hands the
    // model the wall clock, so it dies the same way after a fast
    // stepped clip. Same ratchet, same fix.
    let clock = rebaseOnNextStamp(initialModelClock);
    const stepped = stampAll(clock, [0, 240000]);
    clock = rebaseOnNextStamp(stepped.clock);
    const watched = stampModelClock(clock, 100000);
    expect(watched.modelClockMs ?? NaN).toBeGreaterThan(
      stepped.stamps[1] ?? NaN,
    );
  });
});

describe("what the ratchet must never do", () => {
  it("preserves a source's own gaps exactly, per issue #174", () => {
    // The lift is one constant per source. If the gap between two
    // stamps ever differed from the gap between the two source
    // clocks, machine speed would be back inside the measurement.
    let clock = rebaseOnNextStamp(initialModelClock);
    clock = stampAll(clock, [0, 500]).clock;
    clock = rebaseOnNextStamp(clock);
    const sourceClocks = [40, 73.3, 106.7, 140];
    const { stamps } = stampAll(clock, sourceClocks);
    for (let i = 1; i < sourceClocks.length; i += 1) {
      const gap = (stamps[i] ?? NaN) - (stamps[i - 1] ?? NaN);
      expect(gap).toBeCloseTo(
        (sourceClocks[i] ?? NaN) - (sourceClocks[i - 1] ?? NaN),
        9,
      );
    }
  });

  it("leaves a clock alone when no lift is needed", () => {
    // The common case: a camera on a fresh page, or one starting
    // after a slower-than-real-time clip. The wall clock is already
    // ahead, the offset must be exactly zero, and the model sees
    // the same numbers it has seen since the project began.
    let clock = rebaseOnNextStamp(initialModelClock);
    clock = stampAll(clock, [0, 1000]).clock;
    clock = rebaseOnNextStamp(clock);
    const { stamps } = stampAll(clock, [50000, 50016.7]);
    expect(stamps[0]).toBe(50000);
    expect(stamps[1]).toBe(50016.7);
  });

  it("a first-ever source passes through untouched", () => {
    const clock = rebaseOnNextStamp(initialModelClock);
    const { stamps } = stampAll(clock, [12345.6, 12378.9]);
    expect(stamps).toEqual([12345.6, 12378.9]);
  });
});

describe("the boundary and the belt", () => {
  it("an exactly-equal clock is still lifted strictly above", () => {
    // Strictly increasing means EQUAL is refused too. A camera
    // whose first wall stamp lands exactly on the model's last
    // stamp must still come out above it.
    let clock = rebaseOnNextStamp(initialModelClock);
    const first = stampAll(clock, [777]);
    clock = rebaseOnNextStamp(first.clock);
    const second = stampModelClock(clock, 777);
    expect(second.modelClockMs ?? NaN).toBeGreaterThan(777);
  });

  it("a backwards stamp inside a source is refused, not repaired", () => {
    // frameClock's acceptFrame guards this at the door, so inside a
    // source it should never happen. If it does anyway, repairing
    // it here would fake a gap the source never had — so the model
    // is not called at all for that frame. Null, never a guess.
    let clock = rebaseOnNextStamp(initialModelClock);
    const good = stampModelClock(clock, 1000);
    clock = good.state;
    const backwards = stampModelClock(clock, 900);
    expect(backwards.modelClockMs).toBeNull();
    // The refused frame changes nothing: the next honest frame
    // continues as if it never happened.
    const next = stampModelClock(backwards.state, 1100);
    expect(next.modelClockMs).toBe(1100);
  });

  it("clip after camera still lands above, the direction that already worked", () => {
    // The old clipModelClockBaseMs protected camera-to-clip. The
    // ratchet must not lose that protection while gaining the
    // other direction.
    let clock = rebaseOnNextStamp(initialModelClock);
    const camera = stampAll(clock, [50000, 50033.3]);
    clock = rebaseOnNextStamp(camera.clock);
    const clip = stampModelClock(clock, 0);
    expect(clip.modelClockMs ?? NaN).toBeGreaterThan(50033.3);
  });
});
