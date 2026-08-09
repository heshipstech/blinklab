import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import {
  blinkStep,
  initialBlinkState,
  type BlinkState,
} from "../../src/core/blink";
import {
  APERTURE_HYSTERESIS_FRACTION,
  BLINK_APERTURE_THRESHOLD_MM,
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

// The clock is injected: samples arrive 100 ms apart unless a test
// says otherwise, so durations are hand countable.
function runSeries(
  series: (number | null)[],
  thresholdMm = BLINK_APERTURE_THRESHOLD_MM,
  stepMs = 100,
): BlinkState {
  let state = initialBlinkState;
  series.forEach((value, index) => {
    state = blinkStep(state, index * stepMs, value, thresholdMm);
  });
  return state;
}

describe("blink counting, as since 4.1", () => {
  it("counts one blink for one close and reopen", () => {
    expect(runSeries([8, 8, 3, 2, 3, 8, 8]).blinkCount).toBe(1);
  });

  it("counts two separated blinks as two", () => {
    expect(runSeries([8, 2, 8, 8, 2, 2, 8]).blinkCount).toBe(2);
  });

  it("runs the boundary trio: below closes, at and above stay open", () => {
    // Amended by fix #114: a dip just below the line closes the eye
    // but no longer arms a blink, so the trio watches the eye state
    // itself. The counting path has its own describe below.
    const th = BLINK_APERTURE_THRESHOLD_MM;
    const eyeAt = (apertureMm: number): string => {
      let state = initialBlinkState;
      state = blinkStep(state, 0, 8, th);
      state = blinkStep(state, 100, apertureMm, th);
      return state.eye;
    };
    expect(eyeAt(th - 0.1)).toBe("closed");
    expect(eyeAt(th)).toBe("open");
    expect(eyeAt(th + 0.1)).toBe("open");
  });

  it("refuses to count a blink interrupted by invalid frames", () => {
    expect(runSeries([8, 2, null, 8, 8]).blinkCount).toBe(0);
  });
});

describe("blink duration, new at 4.3", () => {
  it("times a hand countable blink: three closed samples, 300 ms", () => {
    const state = runSeries([8, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(300);
  });

  it("counts a brief closure at exactly the maximum duration", () => {
    // Closed at t=100, reopen at t=600: 500 ms, the boundary, counts.
    const state = runSeries([8, 2, 2, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(500);
  });

  it("keeps the most recent duration when blinks differ", () => {
    const state = runSeries([8, 2, 8, 8, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(2);
    expect(state.lastBlinkDurationMs).toBe(300);
  });

  it("forgets a pending duration when invalid frames interrupt", () => {
    const state = runSeries([8, 2, 2, null, 8, 8]);
    expect(state.blinkCount).toBe(0);
    expect(state.lastBlinkDurationMs).toBeNull();
  });

  it("has no duration before any blink completed", () => {
    expect(runSeries([8, 8, 8]).lastBlinkDurationMs).toBeNull();
  });
});

describe("squint separation, new at 4.7", () => {
  it("counts nothing for the ladder's held squint plateau, five seconds", () => {
    const series: (number | null)[] = [8, ...Array<number>(50).fill(3), 8];
    const state = runSeries(series);
    expect(state.blinkCount).toBe(0);
    expect(state.lastBlinkDurationMs).toBeNull();
  });

  it("refuses a closure just over the maximum, 600 ms", () => {
    const state = runSeries([8, 2, 2, 2, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(0);
    expect(state.lastBlinkDurationMs).toBeNull();
  });

  it("still counts a clearly brief closure, 300 ms", () => {
    const state = runSeries([8, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(300);
  });

  it("keeps the previous blink's duration when a squint follows it", () => {
    const series: (number | null)[] = [
      8,
      2,
      2,
      8,
      ...Array<number>(20).fill(3),
      8,
    ];
    const state = runSeries(series);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(200);
  });
});

describe("depth arming against threshold chatter, fix #114", () => {
  // The owner's evidence, 2026-08-05: aperture riding the blink line
  // while reading filled the log with 17 ms, 0.1 mm "blinks". A
  // closure now arms as a blink only by reaching the threshold minus
  // ten percent. Chatter never dives that deep; real blinks plunge
  // millimetres past it. Closing and reopening are untouched, so
  // every duration keeps its 4.3 definition.
  const armMm =
    BLINK_APERTURE_THRESHOLD_MM * (1 - APERTURE_HYSTERESIS_FRACTION);

  it("counts nothing while the aperture rides the line", () => {
    // Alternating 0.1 mm either side of the 4 mm line, five seconds:
    // fifty shallow unarmed closures, zero blinks.
    const riding = Array.from({ length: 50 }, (_, i) =>
      i % 2 === 0 ? 3.9 : 4.1,
    );
    const state = runSeries([8, ...riding, 8]);
    expect(state.blinkCount).toBe(0);
  });

  it("still counts a real blink mid ride, its own dip arms it", () => {
    // Review killed the first design with this case: a latch folded
    // a real blink into the ride. With arming, each shallow dip ends
    // at the next rise, and the deep dip counts on its own.
    const ride = [3.9, 4.1, 3.9, 4.1, 3.9, 4.1];
    const state = runSeries([8, ...ride, 1, 4.1, ...ride, 8]);
    expect(state.blinkCount).toBe(1);
  });

  it("runs the arm boundary trio: exactly at the arm line still arms", () => {
    const shallow = runSeries([8, armMm + 0.001, 8]);
    expect(shallow.blinkCount).toBe(0);
    const exact = runSeries([8, armMm, 8]);
    expect(exact.blinkCount).toBe(1);
    const deep = runSeries([8, armMm - 0.001, 8]);
    expect(deep.blinkCount).toBe(1);
  });

  it("brackets the fraction behaviorally, not only by restating it", () => {
    // 3.61 mm on the 4 mm line: below a 5 percent arm line, above
    // the 10 percent one. Refusing it kills a shrunken gap; counting
    // 3.6 exactly kills a widened one.
    expect(runSeries([8, 3.61, 8]).blinkCount).toBe(0);
    expect(runSeries([8, 3.6, 8]).blinkCount).toBe(1);
  });

  it("keeps durations at the 4.3 definition, close line to close line", () => {
    // Closed at t=100 through t=200, reopen crosses at t=300: the
    // closed phase is 200 ms, exactly as before the fix.
    const state = runSeries([8, 1, 1, 8]);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(200);
  });

  it("refuses a real but too-shallow closure, the documented cost", () => {
    // A closure bottoming between the arm line and the threshold is
    // indistinguishable from deep chatter, so it does not count. On
    // record in MANUAL item 45: very shallow deliberate blinks may
    // be missed, the price of killing the phantoms.
    const state = runSeries([8, 3.7, 3.7, 8]);
    expect(state.blinkCount).toBe(0);
  });

  it("disarms across invalid frames, gaps stay gaps", () => {
    // A deep dip, a lost face, then a shallow finish: the arming
    // died with the gap, nothing counts.
    const state = runSeries([8, 1, null, 3.9, 8]);
    expect(state.blinkCount).toBe(0);
  });
});

describe("blink timing against the recorded fixture", () => {
  it("times the owner's two blinks at 133 and 117 ms below threshold", () => {
    const session = loadSession01();
    const durations: number[] = [];
    let state = initialBlinkState;
    for (const frame of session.frames) {
      const face = frameLandmarks(frame);
      const right = apertureMm(
        face,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        1280,
        720,
      );
      const left = apertureMm(
        face,
        LEFT_EYE_EAR_INDICES,
        LEFT_IRIS_RING_INDICES,
        1280,
        720,
      );
      const mean = right === null || left === null ? null : (right + left) / 2;
      const before = state.blinkCount;
      state = blinkStep(
        state,
        frame.timestampMs,
        mean,
        BLINK_APERTURE_THRESHOLD_MM,
      );
      if (state.blinkCount > before && state.lastBlinkDurationMs !== null) {
        durations.push(Math.round(state.lastBlinkDurationMs));
      }
    }
    // Fix #114's first design moved the reopen line and re-measured
    // this pin to [133, 133]; review rejected that design, and depth
    // arming leaves every duration exactly as 4.3 recorded it.
    expect(durations).toEqual([133, 117]);
  });
});

describe("the refractory period of #176", () => {
  const OPEN = 10;
  const SHUT = 1;
  const THRESHOLD = 5;

  // Drive the detector through a closure and a reopen.
  const blink = (
    state: BlinkState,
    startMs: number,
    closedMs: number,
  ): BlinkState => {
    let next = blinkStep(state, startMs, SHUT, THRESHOLD);
    next = blinkStep(next, startMs + closedMs, SHUT, THRESHOLD);
    return blinkStep(next, startMs + closedMs, OPEN, THRESHOLD);
  };

  // THE REGRESSION. On the Eyeblink8 benchmark one blink was often
  // reported as two: the aperture rose over the threshold for a frame
  // or two mid-closure and dipped again. 103 of 111 false alarms sat
  // on top of a blink the human had marked.
  it("counts one blink when a closure is split in two", () => {
    let state = blinkStep(initialBlinkState, 0, OPEN, THRESHOLD);
    state = blink(state, 100, 120); // a real blink, ends at 220
    expect(state.blinkCount).toBe(1);
    state = blink(state, 240, 60); // the fragment, ends at 300
    expect(state.blinkCount).toBe(1);
  });

  it("counts both when they are far enough apart to be real", () => {
    let state = blinkStep(initialBlinkState, 0, OPEN, THRESHOLD);
    state = blink(state, 100, 120); // ends at 220
    state = blink(state, 400, 120); // ends at 520, well clear
    expect(state.blinkCount).toBe(2);
  });

  // 150 ms is below the ~200 ms a person can manage deliberately, so
  // the fastest real blinking anyone can produce must still count.
  it("does not suppress deliberate rapid blinking at five a second", () => {
    let state = blinkStep(initialBlinkState, 0, OPEN, THRESHOLD);
    let at = 0;
    for (let i = 0; i < 5; i += 1) {
      state = blink(state, at, 80);
      at += 200;
    }
    expect(state.blinkCount).toBe(5);
  });

  // The failure mode a naive implementation has: if a suppressed
  // closure refreshed the timer, a stream of chatter would push the
  // window forward forever and a genuine later blink would never be
  // counted.
  it("chatter cannot walk the window forward and swallow a real blink", () => {
    let state = blinkStep(initialBlinkState, 0, OPEN, THRESHOLD);
    state = blink(state, 0, 100); // counted, ends at 100
    expect(state.blinkCount).toBe(1);
    // Four fragments, each inside the window of the one before it.
    let at = 120;
    for (let i = 0; i < 4; i += 1) {
      state = blink(state, at, 20);
      at += 30;
    }
    // Still one, and the timer still points at the blink that ended
    // at 100, so a blink at 260 is 160 ms clear and must count.
    expect(state.blinkCount).toBe(1);
    state = blink(state, 240, 20);
    expect(state.blinkCount).toBe(2);
  });

  it("leaves the reported duration of the counted blink alone", () => {
    let state = blinkStep(initialBlinkState, 0, OPEN, THRESHOLD);
    state = blink(state, 100, 120);
    expect(state.lastBlinkDurationMs).toBe(120);
    state = blink(state, 240, 60);
    // The fragment was not counted, so it must not overwrite the
    // duration either. Every duration keeps its 4.3 definition.
    expect(state.lastBlinkDurationMs).toBe(120);
  });
});
