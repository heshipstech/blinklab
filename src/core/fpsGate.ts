import {
  BLINK_RISK_CLEAR_FPS,
  BLINK_RISK_FPS,
  MIN_BLINK_FPS,
} from "./constants";

// Below the minimum frame rate, short blinks slip between frames and
// every temporal blink metric would understate reality with full
// confidence. So they return null, never zero: zero is a claim,
// null is an admission.
export function measurableAtFps(fps: number | null): boolean {
  return fps !== null && fps >= MIN_BLINK_FPS;
}

/**
 * The readout for the rate the pipeline is achieving.
 *
 * Named a PROCESSING rate, deliberately, remediation D1 stage one.
 * The number is how often the frame handler runs, which for a live
 * camera is the display's animation rate: on a 20 frames per second
 * camera the old label read "Frames per second: 70" and a reader took
 * the camera to be fast enough for blink detection when it was not.
 * The honest label buys no new measurement, it stops the existing one
 * from impersonating the camera. Wiring a true camera rate into the
 * 25 fps gate is stage two, held until its blast radius is measured
 * on real hardware, because it will refuse sessions that succeed
 * today.
 *
 * Mode-aware, from review: for a clip the number rides the MEDIA
 * clock (frameClock's frameTimestampMs), so it is the clip's own
 * rate, and "not the camera's" would have been exactly backwards on
 * a 15 fps DROZY recording. The file-mode suffix deliberately avoids
 * the word "Measured": the stepped-clip end to end test anchors its
 * status line on that word, and the first draft's label stole the
 * anchor mid-run.
 */
export function processingRateMessage(
  fps: number | null,
  source: "camera" | "file",
): string {
  if (fps === null) {
    return "Processing rate: measuring...";
  }
  const rounded = String(Math.round(fps));
  return source === "camera"
    ? `Processing rate: ${rounded} frames per second, the instrument's pace, not the camera's`
    : `Processing rate: ${rounded} frames per second, on the clip's own clock`;
}

export function fpsGateMessage(fps: number | null): string {
  if (measurableAtFps(fps)) {
    return "";
  }
  if (fps === null) {
    return "Blink metrics not measurable: the frame rate is still unknown.";
  }
  return `Blink metrics not measurable: ${fps.toFixed(0)} fps is below the ${String(MIN_BLINK_FPS)} fps a short blink needs.`;
}

/**
 * Whether the low-rate warning is showing, remediation D1 stage two.
 *
 * Above the 25 fps floor nothing on the page said anything, and a
 * session at 29 fps and one at 127 both passed silently while finding
 * 7 and 10 of ten deliberate blinks. This is the "say something true"
 * half of that fix: below BLINK_RISK_FPS the risk is real and
 * measured, so the page says so.
 *
 * Since 24 August 2026 the rate judged is the EVIDENCE rate: the
 * measured sampled_fps — distinct camera frames the detector read —
 * where the browser can see delivery, and the processing rate where
 * it cannot. The first delivered-rate measurement forced this: an
 * M5 Max processing 120 on a camera delivering 30 sat squarely in
 * the risk band with the warning silent, because 120 was the number
 * being judged and 30 was the number that mattered. The rule was
 * committed in docs/blink-sample-rate.txt BEFORE that file was
 * read; the thresholds deliberately did not move with it.
 *
 * Stateful on purpose, as enter and clear thresholds five apart. The
 * rate is measured over a two second window and wobbles, so a single
 * threshold would flick the warning on and off on any machine
 * hovering near it, and a warning that flickers reads as a glitch
 * rather than a finding. An unknown rate turns the warning off: the
 * readout beside it already says "measuring...", and warning about a
 * number that does not exist yet would be a guess.
 */
export function rateRiskActive(
  previous: boolean,
  evidenceFps: number | null,
): boolean {
  if (evidenceFps === null) {
    return false;
  }
  if (evidenceFps < BLINK_RISK_FPS) {
    return true;
  }
  if (evidenceFps >= BLINK_RISK_CLEAR_FPS) {
    return false;
  }
  return previous;
}

/**
 * The warning itself. Live camera sessions only: on a clip the
 * processing rate rides the media clock, the risk belongs to the
 * RECORDING's own rate, and the export already carries that number.
 *
 * Two sentences since 24 August 2026, choosing by which rate binds,
 * because the single machine-blaming sentence was measured FALSE on
 * the first device read: it would have sent an M5 Max owner shopping
 * for a faster computer that cannot help. Attribution needs a clear
 * gap before the blame moves — within the same five fps the
 * enter/clear pair already prices as wobble, the two rates are one
 * number seen twice and the older machine sentence stands.
 */
export function rateRiskMessage(
  evidenceFps: number,
  processingFps: number,
): string {
  const cameraBound =
    processingFps - evidenceFps > BLINK_RISK_CLEAR_FPS - BLINK_RISK_FPS;
  if (cameraBound) {
    return (
      `Blink counts may be low with this camera: this instrument is ` +
      `reading ${String(Math.round(evidenceFps))} distinct camera ` +
      `frames per second, and below ${String(BLINK_RISK_FPS)} quick ` +
      `or shallow blinks can be missed. A faster machine would not ` +
      `help; the camera's delivery is the limit. Measured in ` +
      `docs/blink-sample-rate.txt.`
    );
  }
  return (
    `Blink counts may be low on this computer: it is processing ` +
    `${String(Math.round(evidenceFps))} frames per second, and below ` +
    `${String(BLINK_RISK_FPS)} quick or shallow blinks can be missed. ` +
    `The camera is not the cause and a faster machine would count ` +
    `more. Measured in docs/blink-sample-rate.txt.`
  );
}

/**
 * What to say when a whole clip was refused for being too slow.
 *
 * The per-frame message above is correct and nearly invisible: one line
 * of body text in a panel, while everything else on the page carries on
 * looking healthy. That is fine for a momentary dip and useless for a
 * recording that was never measurable at all.
 *
 * Measured on DROZY, 10 August 2026: 16 of 36 sessions were recorded at
 * 15 frames per second, so blink detection never once opened on them.
 * The batch run reported "36 measured, 0 failed" and produced no blink
 * data for nearly half the set, and nobody noticed for an hour. PERCLOS
 * and long closures ride the same gate and were silent too. Issue #192.
 *
 * A refusal is not a failure and must not read as one. The message says
 * what was refused, why, and that the rest of the file is still good.
 */
export function clipRefusedMessage(
  measuredFps: number | null,
  framesMeasured: number,
): string {
  const rate =
    measuredFps === null
      ? "its frame rate could not be established"
      : `it runs at ${measuredFps.toFixed(1)} frames per second`;
  return (
    `NO BLINKS WERE MEASURED IN THIS CLIP, and that is a refusal rather ` +
    `than a failure. All ${String(framesMeasured)} frames were read, but ` +
    `${rate}, below the ${String(MIN_BLINK_FPS)} a short blink needs. At ` +
    `that rate a 100 ms blink spans fewer than two frames and timing it ` +
    `would be a guess. Eye closure share and long closures are refused ` +
    `for the same reason. Everything else in the export is still valid.`
  );
}
