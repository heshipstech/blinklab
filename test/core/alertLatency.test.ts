import { describe, expect, it } from "vitest";

import {
  ALERT_DEBOUNCE_MS,
  alertStep,
  initialAlertState,
  type AlertState,
} from "../../src/core/alert";
import {
  personalThresholdMm,
  type BaselineState,
} from "../../src/core/baseline";
import { baselineStep } from "../../src/core/baseline";
import {
  blinkStep,
  initialBlinkState,
  type BlinkState,
} from "../../src/core/blink";
import {
  LONG_CLOSURE_THRESHOLD_MS,
  initialLongClosureState,
  longClosureStep,
  longClosureThresholdMm,
  type LongClosureState,
} from "../../src/core/longClosure";
import {
  emptyPerclos,
  perclosStep,
  type PerclosState,
} from "../../src/core/perclos";

// Roadmap 7.8: latency measurement. Two questions, both answerable
// without a camera because every step on the path is a pure function.
//
// First, time from eye closure to alert. The long closure detector
// fires on the first FRAME strictly beyond LONG_CLOSURE_THRESHOLD_MS
// after the closure began, and the alert governor fires on that same
// frame when outside its debounce window. So the latency is the
// threshold plus at most one frame period: it cannot be less by
// design, and how much more depends only on where the frames land.
// The numbers below are exact, not tolerances, because the whole
// path is deterministic.
//
// Second, per-frame compute cost of the core chain the frame handler
// runs on that path: baseline, blink, long closure, alert, PERCLOS.
// That one IS machine-dependent, so the test asserts a generous
// ceiling and prints the measured figure only when asked, the same
// arrangement as blinkSampleRate.test.ts. What this does NOT
// include, stated so nobody reads it as the whole story: the face
// model's own inference (about 6 ms, recorded locally in roadmap
// 8.7, since CI machines have no camera) and the camera's exposure
// and delivery, which no page can see.

const BASELINE_MM = 7.78; // the owner's measured macbookair2 session
const OPEN_MM = 7.0;
const SHUT_MM = 2.0; // well under the 40 percent shut line of 3.11

declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write: (text: string) => void };
};

type AlertFire = { atMs: number };

/**
 * Drive the closure-to-alert path with frames at a fixed rate: open
 * for one second, then shut. Returns when the alert fired, measured
 * from the first shut frame.
 */
function alertLatencyMs(rateHz: number): number {
  const periodMs = 1000 / rateHz;
  const shutLine = longClosureThresholdMm(BASELINE_MM);
  let closure: LongClosureState = initialLongClosureState;
  let alert: AlertState = initialAlertState;
  let firstShutAtMs: number | null = null;
  const fires: AlertFire[] = [];
  for (let frame = 0; frame < Math.ceil(rateHz * 3); frame += 1) {
    const nowMs = frame * periodMs;
    const shut = nowMs >= 1000;
    if (shut && firstShutAtMs === null) {
      firstShutAtMs = nowMs;
    }
    const before = closure.count;
    closure = longClosureStep(
      closure,
      nowMs,
      shut ? SHUT_MM : OPEN_MM,
      shutLine,
    );
    const result = alertStep(alert, nowMs, closure.count > before);
    alert = result.state;
    if (result.fires) {
      fires.push({ atMs: nowMs });
    }
  }
  const fired = fires[0];
  if (fired === undefined || firstShutAtMs === null) {
    throw new Error("the alert never fired");
  }
  return fired.atMs - firstShutAtMs;
}

describe("time from eye closure to alert (roadmap 7.8)", () => {
  it("is the long closure threshold plus at most one frame period", () => {
    for (const rateHz of [25, 30, 60, 120]) {
      const periodMs = 1000 / rateHz;
      const latency = alertLatencyMs(rateHz);
      // Strictly beyond the threshold: an alert at or before 500 ms
      // would mean the blink/long-closure partition leaked.
      expect(latency).toBeGreaterThan(LONG_CLOSURE_THRESHOLD_MS);
      expect(latency).toBeLessThanOrEqual(
        LONG_CLOSURE_THRESHOLD_MS + periodMs + 1e-9,
      );
    }
  });

  it("lands on the first frame past the threshold, exactly", () => {
    // 25 Hz frames land at 40 ms steps: the first one past 500 ms of
    // closure is 520. At 30 Hz it is 533.3, at 60 Hz 516.7. These are
    // the numbers docs/latency.txt records.
    expect(alertLatencyMs(25)).toBeCloseTo(520.0, 6);
    expect(alertLatencyMs(30)).toBeCloseTo(533.333, 2);
    expect(alertLatencyMs(60)).toBeCloseTo(516.667, 2);
  });

  it("a second closure inside the debounce window is suppressed, not told", () => {
    // The other latency regime, stated rather than implied: within
    // ALERT_DEBOUNCE_MS of a firing, a new long closure is counted
    // but the person is not told, so the worst-case time from closure
    // to a TOLD person is the debounce window plus the detection
    // latency above. That is the governor's deliberate trade against
    // alarm fatigue, not an accident.
    const shutLine = longClosureThresholdMm(BASELINE_MM);
    let closure: LongClosureState = initialLongClosureState;
    let alert: AlertState = initialAlertState;
    let fires = 0;
    const periodMs = 1000 / 30;
    // Two long closures separated by a short reopen, both inside one
    // debounce window.
    for (let frame = 0; frame < Math.ceil(30 * 3); frame += 1) {
      const nowMs = frame * periodMs;
      const reopen = nowMs >= 700 && nowMs < 900;
      const before = closure.count;
      closure = longClosureStep(
        closure,
        nowMs,
        reopen ? OPEN_MM : SHUT_MM,
        shutLine,
      );
      const result = alertStep(alert, nowMs, closure.count > before);
      alert = result.state;
      if (result.fires) fires += 1;
    }
    expect(closure.count).toBe(2);
    expect(fires).toBe(1);
    expect(alert.suppressedCount).toBe(1);
    expect(ALERT_DEBOUNCE_MS).toBe(5000);
  });
});

describe("per-frame compute cost of the core chain (roadmap 7.8)", () => {
  it("stays far under a frame budget, with a generous tolerance", () => {
    // The chain main.ts runs per frame on the closure-to-alert path,
    // in main.ts's own order, over a realistic minute: a blink every
    // two seconds and one long closure, at 60 Hz. PERCLOS carries a
    // 60-second window, so by the end every frame pays the full
    // window cost, which is the honest worst case.
    const rateHz = 60;
    const periodMs = 1000 / rateHz;
    const frames = 60 * rateHz;
    const shutLine = longClosureThresholdMm(BASELINE_MM);

    const apertureAt = (nowMs: number): number => {
      if (nowMs >= 40_000 && nowMs < 41_000) return SHUT_MM; // long closure
      const phase = nowMs % 2000;
      return phase < 150 ? SHUT_MM : OPEN_MM; // a 150 ms blink every 2 s
    };

    const run = (): number => {
      let baseline: BaselineState = {
        kind: "ready",
        baselineMm: BASELINE_MM,
        // A synthetic birth certificate for a synthetic session: one
        // steady sample, spread one, nothing bound.
        window: {
          sampleCount: 1,
          medianMm: BASELINE_MM,
          p90Mm: BASELINE_MM,
          spreadRatio: 1,
          ceilingBound: false,
          baselineMm: BASELINE_MM,
        },
      };
      let blink: BlinkState = initialBlinkState;
      let closure: LongClosureState = initialLongClosureState;
      let alert: AlertState = initialAlertState;
      let perclos: PerclosState = emptyPerclos();
      const startedAt = performance.now();
      for (let frame = 0; frame < frames; frame += 1) {
        const nowMs = frame * periodMs;
        const apertureMm = apertureAt(nowMs);
        baseline = baselineStep(baseline, nowMs, apertureMm);
        const thresholdMm = personalThresholdMm(baseline) ?? 0;
        blink = blinkStep(blink, nowMs, apertureMm, thresholdMm);
        const before = closure.count;
        closure = longClosureStep(closure, nowMs, apertureMm, shutLine);
        alert = alertStep(alert, nowMs, closure.count > before).state;
        perclos = perclosStep(perclos, nowMs, apertureMm, BASELINE_MM);
      }
      // The states are read once so no clever runtime can discard
      // the loop as dead code.
      expect(blink.blinkCount).toBeGreaterThan(20);
      expect(closure.count).toBe(1);
      expect(alert.firedCount).toBe(1);
      expect(perclos.samples.length).toBeGreaterThan(0);
      return (performance.now() - startedAt) / frames;
    };

    run(); // warm-up, so the measured pass is not paying JIT costs
    const perFrameMs = run();
    if (process.env["BLINKLAB_PRINT_TABLE"] !== undefined) {
      process.stdout.write(
        `\ncore chain per frame: ${(perFrameMs * 1000).toFixed(1)} microseconds` +
          ` over ${String(frames)} frames at ${String(rateHz)} Hz\n\n`,
      );
    }
    // The measured figure is tens of microseconds; the ceiling is two
    // milliseconds so a noisy CI machine cannot turn this red while a
    // real regression, an accidental O(n) growth per frame, still
    // would. The tolerance IS the check the roadmap row asks for.
    expect(perFrameMs).toBeLessThan(2);
  });
});
