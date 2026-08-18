import { blinkStep, initialBlinkState } from "../../src/core/blink";

// A blink as an aperture trace, so the real detector can be asked
// questions no recorded session can answer.
//
// Built for the sampling-rate experiment of 17 August and shared with
// the duration-ceiling reconciliation of issue #178, because both need
// the same thing: run one closure past `blinkStep` with every variable
// held still except the one under test.
//
// The optics are a parameter rather than a constant. A healthy session
// puts the blink line far below the resting eyelid; a session whose
// baseline has ratcheted puts it ABOVE, and issue #126's noise case
// only exists in the second state.

/** Where the lines sit for a session, in millimetres. */
export type Optics = {
  /** The eyelid opening at rest. */
  openMm: number;
  /** Half the learned baseline: below this the eye reads as closed. */
  thresholdMm: number;
};

/** The depth at which a closure arms, from fix #114's hysteresis. */
export function armLineMm(optics: Optics, hysteresis: number): number {
  return optics.thresholdMm * (1 - hysteresis);
}

export type Blink = {
  /** Lowest aperture the lid reaches, in millimetres. */
  minMm: number;
  /** How long the lid takes to come down, and to go back up. */
  closeMs: number;
  openMs: number;
};

/**
 * The aperture at a moment, for one excursion starting at t = 0.
 *
 * A raised cosine down and another up, smooth at both ends and at the
 * bottom. Real eyelids close faster than they open, so the two halves
 * take different times.
 */
export function apertureAt(blink: Blink, optics: Optics, tMs: number): number {
  const depth = optics.openMm - blink.minMm;
  if (tMs <= 0 || tMs >= blink.closeMs + blink.openMs) return optics.openMm;
  const phase =
    tMs < blink.closeMs
      ? tMs / blink.closeMs / 2
      : 0.5 + (tMs - blink.closeMs) / blink.openMs / 2;
  return optics.openMm - (depth * (1 - Math.cos(2 * Math.PI * phase))) / 2;
}

/** How long the trace spends at or below a line, by fine search. */
export function msBelow(blink: Blink, optics: Optics, lineMm: number): number {
  const total = blink.closeMs + blink.openMs;
  let count = 0;
  for (let t = 0; t <= total; t += 0.1) {
    if (apertureAt(blink, optics, t) <= lineMm) count += 1;
  }
  return count * 0.1;
}

/** What the detector made of one excursion, sampled at a rate and phase. */
export function detect(
  blink: Blink,
  optics: Optics,
  rateHz: number,
  phaseMs: number,
): { count: number; lastDurationMs: number | null } {
  const periodMs = 1000 / rateHz;
  const total = blink.closeMs + blink.openMs;
  // A second of settled eye either side, so the detector is not still
  // in its "unknown" state when the excursion arrives and has somewhere
  // to reopen into afterwards.
  let state = initialBlinkState;
  for (let t = -1000 + phaseMs; t <= total + 1000; t += periodMs) {
    state = blinkStep(
      state,
      t + 2000,
      apertureAt(blink, optics, t),
      optics.thresholdMm,
    );
  }
  return { count: state.blinkCount, lastDurationMs: state.lastBlinkDurationMs };
}

/** The share of phase offsets at which the excursion is counted, 0 to 1. */
export function detectionRate(
  blink: Blink,
  optics: Optics,
  rateHz: number,
  steps = 200,
): number {
  const periodMs = 1000 / rateHz;
  let found = 0;
  for (let step = 0; step < steps; step += 1) {
    if (detect(blink, optics, rateHz, (step / steps) * periodMs).count === 1) {
      found += 1;
    }
  }
  return found / steps;
}
