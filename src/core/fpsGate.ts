import { MIN_BLINK_FPS } from "./constants";

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
