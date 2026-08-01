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
