import { describe, expect, it } from "vitest";

import {
  gatedBlinkRatePerMin,
  recordBlink,
  startRate,
} from "../../src/core/blinkRate";
import {
  BLINK_RISK_CLEAR_FPS,
  BLINK_RISK_FPS,
  MIN_BLINK_FPS,
} from "../../src/core/constants";
import {
  clipRefusedMessage,
  fpsGateMessage,
  measurableAtFps,
  processingRateMessage,
  rateRiskActive,
  rateRiskMessage,
} from "../../src/core/fpsGate";

describe("measurableAtFps", () => {
  it("runs the boundary trio at the minimum", () => {
    expect(measurableAtFps(MIN_BLINK_FPS - 0.1)).toBe(false);
    expect(measurableAtFps(MIN_BLINK_FPS)).toBe(true);
    expect(measurableAtFps(MIN_BLINK_FPS + 0.1)).toBe(true);
  });

  it("treats an unknown fps as unmeasurable", () => {
    expect(measurableAtFps(null)).toBe(false);
  });
});

describe("the ladder's assertion: null, not zero", () => {
  it("returns null below the gate even though blinks exist", () => {
    let rate = startRate(0);
    rate = recordBlink(rate, 10000);
    rate = recordBlink(rate, 20000);
    expect(gatedBlinkRatePerMin(20, rate, 30000)).toBeNull();
    expect(gatedBlinkRatePerMin(20, rate, 30000)).not.toBe(0);
  });

  it("returns the true number at and above the gate", () => {
    let rate = startRate(0);
    rate = recordBlink(rate, 10000);
    rate = recordBlink(rate, 20000);
    expect(gatedBlinkRatePerMin(MIN_BLINK_FPS, rate, 30000)).toBeCloseTo(4, 6);
    expect(gatedBlinkRatePerMin(60, rate, 30000)).toBeCloseTo(4, 6);
  });
});

describe("fpsGateMessage", () => {
  it("stays silent while measurable", () => {
    expect(fpsGateMessage(60)).toBe("");
  });

  it("names the current fps and the minimum when refusing", () => {
    const message = fpsGateMessage(18);
    expect(message).toContain("18");
    expect(message).toContain(String(MIN_BLINK_FPS));
  });

  it("explains an unknown fps readably", () => {
    expect(fpsGateMessage(null).length).toBeGreaterThan(10);
  });
});

describe("clipRefusedMessage, a whole clip below the floor", () => {
  // THE REAL CASE. 16 of 36 DROZY sessions were recorded at 15 frames
  // per second, so blink detection never once opened on them. The batch
  // reported "36 measured, 0 failed" and produced no blink data for
  // nearly half the set. Issue #192.
  it("says a refusal is not a failure, and names the rate", () => {
    const text = clipRefusedMessage(15, 1800);
    expect(text).toContain("refusal rather than a failure");
    expect(text).toContain("15.0 frames per second");
    expect(text).toContain("1800");
  });

  it("names the floor it did not clear", () => {
    expect(clipRefusedMessage(15, 1800)).toContain(String(MIN_BLINK_FPS));
  });

  it("says the rest of the export is still good", () => {
    // Otherwise a reader throws away a file that is largely fine.
    expect(clipRefusedMessage(15, 1800)).toContain("still valid");
  });

  it("names the other measurements that ride the same gate", () => {
    // PERCLOS and long closures were silent too, and a message that
    // mentions only blinks leaves the reader hunting for those.
    const text = clipRefusedMessage(15, 1800);
    expect(text).toContain("Eye closure share");
    expect(text).toContain("long closures");
  });

  it("copes when the frame rate could not be established at all", () => {
    expect(clipRefusedMessage(null, 900)).toContain("could not be established");
  });
});

describe("the processing rate readout (remediation D1, stage one)", () => {
  it("names itself a processing rate and disowns the camera, live", () => {
    // On a 20 fps camera the old label read "Frames per second: 70",
    // and a reader took the camera to be fast enough for blink
    // detection. The label now says what the number is and is not.
    const message = processingRateMessage(59.7, "camera");
    expect(message).toBe(
      "Processing rate: 60 frames per second, the instrument's pace, not the camera's",
    );
    expect(processingRateMessage(null, "camera")).toBe(
      "Processing rate: measuring...",
    );
    expect(message).not.toContain("Frames per second:");
  });

  it("owns the clip's clock in file mode instead of disowning it", () => {
    // Review caught the first draft applying the camera suffix to
    // clips, where the number rides the media clock and IS the
    // source's rate: exactly backwards on a 15 fps DROZY recording.
    expect(processingRateMessage(15, "file")).toBe(
      "Processing rate: 15 frames per second, on the clip's own clock",
    );
  });
});

describe("the low-rate warning (remediation D1, stage two)", () => {
  // Owner's decision, 20 August 2026: below 60 processed frames per
  // second the page says out loud that blinks may be missed. The
  // threshold is where docs/blink-sample-rate.txt measures the risk
  // band closing, and the field sessions agree: misses at 29 to 31
  // fps, none at 55 and 127.
  it("runs the boundary trio at the enter threshold", () => {
    expect(rateRiskActive(false, BLINK_RISK_FPS - 0.1)).toBe(true);
    expect(rateRiskActive(false, BLINK_RISK_FPS)).toBe(false);
    expect(rateRiskActive(false, BLINK_RISK_FPS + 0.1)).toBe(false);
  });

  it("holds inside the hysteresis band instead of flickering", () => {
    // The rate is measured over a two second window and wobbles, so
    // enter and clear sit five apart. Between them the warning keeps
    // whatever it was: a machine hovering at 61 fps must not flick a
    // finding on and off every second.
    const inside = (BLINK_RISK_FPS + BLINK_RISK_CLEAR_FPS) / 2;
    expect(rateRiskActive(true, inside)).toBe(true);
    expect(rateRiskActive(false, inside)).toBe(false);
    expect(rateRiskActive(true, BLINK_RISK_CLEAR_FPS)).toBe(false);
  });

  it("turns off on an unknown rate rather than guessing", () => {
    // The readout beside it already says "measuring...".
    expect(rateRiskActive(true, null)).toBe(false);
  });

  it("states the machine's own number and where the risk was measured", () => {
    // The machine-bound sentence: the instrument reads every frame
    // the camera hands it and is still slow, so the machine IS the
    // cause and the pre-correction claim stands for this shape.
    const message = rateRiskMessage(46.6, 46.6);
    expect(message).toContain("47 frames per second");
    expect(message).toContain(`below ${String(BLINK_RISK_FPS)}`);
    expect(message).toContain("docs/blink-sample-rate.txt");
    // The dry run's core lesson, so a reader does not swap webcams.
    expect(message).toContain("The camera is not the cause");
  });

  it("names the camera when the camera is what binds, 24 August 2026", () => {
    // The first delivered-rate measurement, the M5 Max: processing
    // 120 on a camera delivering 30, every delivered frame read, so
    // the evidence rate is 30 and blaming the machine would send a
    // reader shopping for a faster computer that cannot help. The
    // sentence is the one committed word for word in the
    // pre-decision (docs/blink-sample-rate.txt) BEFORE this
    // measurement existed.
    expect(rateRiskMessage(30, 120)).toBe(
      "Blink counts may be low with this camera: this instrument is " +
        "reading 30 distinct camera frames per second, and below " +
        `${String(BLINK_RISK_FPS)} quick or shallow blinks can be ` +
        "missed. A faster machine would not help; the camera's " +
        "delivery is the limit. Measured in docs/blink-sample-rate.txt.",
    );
  });

  it("attribution needs a clear gap, priced like the hysteresis band", () => {
    // Within five fps the two rates are the same number seen through
    // the measurement wobble the enter/clear pair already prices, so
    // the older machine sentence stands; past it, the camera is
    // named. Exactly five is still inside.
    expect(rateRiskMessage(55, 60)).toContain("The camera is not the cause");
    expect(rateRiskMessage(54, 60)).toContain(
      "the camera's delivery is the limit",
    );
  });
});
