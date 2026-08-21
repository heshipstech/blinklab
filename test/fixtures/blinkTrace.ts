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

// THE CAMERA'S OWN GRID, added 21 August 2026.
//
// Everything above models an eyelid the page can read at any instant,
// which is an infinitely fast camera. A real camera delivers frames on
// its own clock and the page reads whichever one arrived last, so a
// processing tick between two deliveries re-reads the older frame and
// learns nothing new about the lid.
//
// This matters because src/io/frameLoop.ts drives the camera from
// requestAnimationFrame with no check that a frame arrived, and
// src/io/camera.ts requests a resolution and no frame rate. The same
// file already refuses to make this mistake for CLIPS, in a comment
// that explains exactly why: reading an interpolated clock at display
// rate "would report the display's refresh rate as the clip's frame
// rate". The camera path never got that treatment.

/** How the frames the detector reads are produced. */
export type Sampling = {
  /** How often the page runs the detector: the processing rate. */
  processHz: number;
  /**
   * How often the CAMERA hands over a new frame. Infinity is the model
   * used above and in the 17 August table, kept as a special case so
   * the two can be pinned against each other rather than diverging.
   */
  deliveryHz: number;
};

/**
 * The aperture the detector actually reads at `tMs`: the most recent
 * DELIVERED frame at or before it, held until the next arrives.
 *
 * Sample and hold, which is what a camera plus a display-rate loop
 * physically is. The delivery grid runs through `deliveryPhaseMs` in
 * both directions, so the settled second before the excursion is
 * sampled on the same grid as the excursion itself.
 */
export function deliveredApertureAt(
  blink: Blink,
  optics: Optics,
  tMs: number,
  deliveryHz: number,
  deliveryPhaseMs: number,
): number {
  if (!Number.isFinite(deliveryHz)) {
    return apertureAt(blink, optics, tMs);
  }
  const periodMs = 1000 / deliveryHz;
  const index = Math.floor((tMs - deliveryPhaseMs) / periodMs);
  return apertureAt(blink, optics, deliveryPhaseMs + index * periodMs);
}

/** What the detector made of one excursion, at both grids and phases. */
export function detectDelivered(
  blink: Blink,
  optics: Optics,
  sampling: Sampling,
  deliveryPhaseMs: number,
  processPhaseMs: number,
): { count: number; lastDurationMs: number | null } {
  const periodMs = 1000 / sampling.processHz;
  const total = blink.closeMs + blink.openMs;
  let state = initialBlinkState;
  for (let t = -1000 + processPhaseMs; t <= total + 1000; t += periodMs) {
    state = blinkStep(
      state,
      t + 2000,
      deliveredApertureAt(
        blink,
        optics,
        t,
        sampling.deliveryHz,
        deliveryPhaseMs,
      ),
      optics.thresholdMm,
    );
  }
  return { count: state.blinkCount, lastDurationMs: state.lastBlinkDurationMs };
}

/**
 * The share of phase offsets at which the excursion is counted, now
 * over BOTH uncontrolled phases: where the camera's grid falls against
 * the blink, and where the processing grid falls against the camera's.
 *
 * The delivery phase is swept finely and the processing phase coarsely,
 * because the first is the one that decides which part of the lid's
 * travel was ever photographed. The second only decides which of the
 * already-taken frames get read.
 */
export function deliveredDetectionRate(
  blink: Blink,
  optics: Optics,
  sampling: Sampling,
  // 200 x 16. Measured rather than picked: at 50 x 8 roughly half the
  // cells of the published table were wrong in the second decimal, so
  // the sweep was resolving about a fiftieth and the numbers printed a
  // hundredth. 100 x 16, 200 x 16, 200 x 32 and 400 x 32 were compared
  // cell by cell; 200 x 16 and 200 x 32 agree exactly and 400 x 32
  // moves no cell by more than 0.0025, which is the residual quoted
  // beside the table. Raising the PROCESS steps past 16 changes
  // nothing, because the phase that decides which part of the lid's
  // travel was photographed is the camera's, not the reader's.
  deliverySteps = 200,
  processSteps = 16,
): number {
  // With an infinite delivery grid there is no camera phase to sweep,
  // so spending part of the budget on it would sample the one axis
  // that DOES matter eight times and quietly report a coarser number
  // than the 17 August table. Give the whole budget to the processing
  // phase instead. Found by the pin test below disagreeing at 25 Hz.
  const infinite = !Number.isFinite(sampling.deliveryHz);
  const deliveryLoop = infinite ? 1 : deliverySteps;
  const processLoop = infinite ? deliverySteps * processSteps : processSteps;
  const deliveryPeriodMs = infinite ? 0 : 1000 / sampling.deliveryHz;
  const processPeriodMs = 1000 / sampling.processHz;
  let found = 0;
  for (let d = 0; d < deliveryLoop; d += 1) {
    for (let p = 0; p < processLoop; p += 1) {
      const result = detectDelivered(
        blink,
        optics,
        sampling,
        (d / deliveryLoop) * deliveryPeriodMs,
        (p / processLoop) * processPeriodMs,
      );
      if (result.count === 1) found += 1;
    }
  }
  return found / (deliveryLoop * processLoop);
}
