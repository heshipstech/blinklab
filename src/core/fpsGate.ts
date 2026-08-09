import { MIN_BLINK_FPS } from "./constants";

// Below the minimum frame rate, short blinks slip between frames and
// every temporal blink metric would understate reality with full
// confidence. So they return null, never zero: zero is a claim,
// null is an admission.
export function measurableAtFps(fps: number | null): boolean {
  return fps !== null && fps >= MIN_BLINK_FPS;
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
