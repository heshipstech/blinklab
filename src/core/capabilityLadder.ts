// Roadmap 13.6a. The capability ladder: what THIS SETUP can deliver,
// said from numbers the session already measured and from boundaries
// other documents already committed — never from a fresh opinion.
//
// Three rungs. The delivered rate is judged against the committed
// sampling model's own bands (docs/blink-sample-rate.txt): below the
// 25 frames per second floor the detector refuses outright, from 25
// to 60 a minimal blink's catch odds run from about half to certain,
// and at 60 or above the model puts them near certain. The iris
// ruler is judged against the 22 pixel line the frame-rate adoption
// condition committed (docs/frame-rate-negotiation.txt): the
// smallest iris the record has published a sound session at. The
// light rung is UNKNOWN BY DESIGN: sceneLum and faceLum ride every
// exported row, but no committed threshold rules them, and roadmap
// 13.6b either derives one from committed data or the cell stays
// unknown — a rule this module states rather than pre-empts.
//
// The ladder is DERIVED, NEVER EXPORTED, the sessionVerdict rule:
// the export carries the measurements, and a verdict a reader can
// recompute is worth more than one they must trust. Every null input
// reads "unknown", never a guess — a capability cannot be claimed
// from silence.

import { BLINK_RISK_FPS, MIN_BLINK_FPS } from "./constants";
import type { SurfaceStatus } from "./sessionVerdict";

/**
 * The smallest iris the record has published a sound session at, in
 * pixels — the MacBook Air's, adopted as the ruler line by
 * docs/frame-rate-negotiation.txt's committed condition. A test pins
 * this constant to that document's value, so it cannot quietly
 * re-rule the condition from here.
 */
export const IRIS_SOUND_SESSION_PX = 22;

export type LadderRungName = "deliveredRate" | "irisRuler" | "light";

export type LadderRung = {
  rung: LadderRungName;
  status: SurfaceStatus;
  sentence: string;
};

export type LadderInputs = {
  /** The measured rate of distinct frames read, as exported. */
  sampledFps: number | null;
  /** The session's median iris width in the measured frame, as exported. */
  irisWidthPx: number | null;
};

function deliveredRateRung(sampledFps: number | null): LadderRung {
  if (sampledFps === null) {
    return {
      rung: "deliveredRate",
      status: "unknown",
      sentence:
        "Delivered rate unknown: this browser did not report camera " +
        "delivery, and a capability cannot be claimed from silence " +
        "(docs/blink-sample-rate.txt).",
    };
  }
  if (sampledFps < MIN_BLINK_FPS) {
    return {
      rung: "deliveredRate",
      status: "refused",
      sentence:
        `Delivered rate ${sampledFps.toFixed(1)} frames per second: ` +
        `below the ${String(MIN_BLINK_FPS)} frames per second floor ` +
        "where blink detection refuses (docs/blink-sample-rate.txt).",
    };
  }
  if (sampledFps >= BLINK_RISK_FPS) {
    return {
      rung: "deliveredRate",
      status: "ok",
      sentence:
        `Delivered rate ${sampledFps.toFixed(1)} frames per second: at ` +
        `or above ${String(BLINK_RISK_FPS)}, where the committed ` +
        "sampling model puts a minimal blink's catch odds near certain " +
        "(docs/blink-sample-rate.txt).",
    };
  }
  return {
    rung: "deliveredRate",
    status: "warned",
    sentence:
      `Delivered rate ${sampledFps.toFixed(1)} frames per second: in ` +
      `the ${String(MIN_BLINK_FPS)} to ${String(BLINK_RISK_FPS)} band, ` +
      "where a minimal blink's catch odds run from about half to " +
      "certain (docs/blink-sample-rate.txt).",
  };
}

function irisRulerRung(irisWidthPx: number | null): LadderRung {
  if (irisWidthPx === null) {
    return {
      rung: "irisRuler",
      status: "unknown",
      sentence:
        "Iris ruler unknown: no iris was measured this session, so " +
        "the millimetre scale's resolution here is unclaimed " +
        "(docs/frame-rate-negotiation.txt).",
    };
  }
  if (irisWidthPx >= IRIS_SOUND_SESSION_PX) {
    return {
      rung: "irisRuler",
      status: "ok",
      sentence:
        `Iris ruler ${irisWidthPx.toFixed(1)} pixels: at or above the ` +
        `${String(IRIS_SOUND_SESSION_PX)} pixels of the smallest iris ` +
        "the record has published a sound session at " +
        "(docs/frame-rate-negotiation.txt).",
    };
  }
  return {
    rung: "irisRuler",
    status: "warned",
    sentence:
      `Iris ruler ${irisWidthPx.toFixed(1)} pixels: below the smallest ` +
      `published-sound iris of ${String(IRIS_SOUND_SESSION_PX)} pixels, ` +
      "so every millimetre rides fewer source pixels " +
      "(docs/frame-rate-negotiation.txt).",
  };
}

const LIGHT_RUNG: LadderRung = {
  rung: "light",
  status: "unknown",
  sentence:
    "Light: unknown by design. Scene and face luminance are measured " +
    "on every exported row, but no committed threshold rules them — " +
    "roadmap 13.6b derives one from committed data, or this cell " +
    "stays unknown.",
};

/** The three rungs, in ladder order, from what is already measured. */
export function capabilityLadder(inputs: LadderInputs): LadderRung[] {
  return [
    deliveredRateRung(inputs.sampledFps),
    irisRulerRung(inputs.irisWidthPx),
    LIGHT_RUNG,
  ];
}
