// The stimulus for the pre-registered light-response experiment
// (docs/pupil-light-plan.md, roadmap 9.4): a full-screen brightness
// alternation on a fixed schedule, so the pupil's light reflex — if the
// webcam estimate can resolve it — shows up as smaller pupils in the
// bright phases.
//
// This module is the PURE schedule: which phase the screen should show
// at a given moment from the stimulus start, and nothing about the
// screen, the clock, or the camera. The io layer paints the colour and
// reads the clock; every boundary the analysis will later divide the
// session by is decided here, where it can be checked without a browser.
//
// The schedule is fixed here, before any camera runs, exactly as the
// plan fixes it: a 20-second settle that the analysis discards, then six
// cycles of 20 seconds dark then 20 seconds bright. Settle is shown dark
// so the pupil enters the first measured dark phase already dilated and
// stable rather than mid-constriction.

export type LightPhase = "settle" | "dark" | "bright" | "done";

/** The settle the analysis throws away, so the pupil starts stable. */
export const LIGHT_SETTLE_MS = 20_000;
/** One dark or one bright span. */
export const LIGHT_PHASE_MS = 20_000;
/** Dark-then-bright pairs. */
export const LIGHT_CYCLES = 6;
/** The whole run, settle included: 20s + 6 × (20s + 20s) = 260s. */
export const LIGHT_TOTAL_MS =
  LIGHT_SETTLE_MS + LIGHT_CYCLES * 2 * LIGHT_PHASE_MS;

/**
 * The phase the screen should show `elapsedMs` after the stimulus
 * started. Settle covers everything before the first cycle (a negative
 * elapsed included, which should not happen but must not misread as a
 * measured phase); "done" covers everything at or past the end.
 *
 * Within the run each 20-second slot alternates dark, bright, dark, …
 * because every cycle is dark THEN bright, so an even slot is dark and
 * an odd slot is bright.
 */
export function lightPhaseAt(elapsedMs: number): LightPhase {
  if (elapsedMs < LIGHT_SETTLE_MS) {
    return "settle";
  }
  if (elapsedMs >= LIGHT_TOTAL_MS) {
    return "done";
  }
  const slot = Math.floor((elapsedMs - LIGHT_SETTLE_MS) / LIGHT_PHASE_MS);
  return slot % 2 === 0 ? "dark" : "bright";
}

/**
 * The screen colour each phase paints. The stimulus IS this colour, so
 * the mapping is a measurement decision, not styling, and lives here
 * where a test pins it rather than in the DOM code.
 *
 * Settle rides with dark (near-black) so the eye is already dark-adapted
 * entering the first measured dark phase; bright is near-white, the
 * light that should constrict the pupil; done is a neutral grey that is
 * neither stimulus, shown only after the run so its light never lands in
 * a measured phase.
 */
export function lightPhaseBackground(phase: LightPhase): string {
  switch (phase) {
    case "bright":
      return "#ffffff";
    case "settle":
    case "dark":
      return "#000000";
    case "done":
      return "#3a3a3a";
  }
}

/** One point where the phase changes, `atMs` after the stimulus start. */
export type LightBoundary = { atMs: number; phase: LightPhase };

/**
 * Every phase boundary from the start, in order: settle at 0, then the
 * twelve dark/bright slots, then done at the end. The io layer uses this
 * to know when to repaint without polling every frame, and it is the
 * schedule a reader can check the constants against.
 */
export function lightScheduleTransitions(): LightBoundary[] {
  const boundaries: LightBoundary[] = [{ atMs: 0, phase: "settle" }];
  for (let slot = 0; slot < LIGHT_CYCLES * 2; slot += 1) {
    boundaries.push({
      atMs: LIGHT_SETTLE_MS + slot * LIGHT_PHASE_MS,
      phase: slot % 2 === 0 ? "dark" : "bright",
    });
  }
  boundaries.push({ atMs: LIGHT_TOTAL_MS, phase: "done" });
  return boundaries;
}
