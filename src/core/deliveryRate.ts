import { keepRecent, measureFps } from "./fps";

// The rate the camera actually DELIVERED, and how much of it was read.
//
// This instrument has carried two frame rates and neither is the one
// that decides whether a blink was photographed.
//
// `camera_declared_fps` is what getSettings claims the camera is
// configured for. It read 30.0 in all twelve measured sessions, which
// is a claim rather than a measurement.
//
// `measured_fps` counts calls into the face model, so it is the
// PROCESSING rate. On a fast machine it reports far more observations
// per second than the camera produced: src/io/frameLoop.ts drives the
// camera from requestAnimationFrame with no check that a new frame
// arrived, so a 127 fps session on a 30 fps camera re-reads each
// delivered frame about four times and counts each re-read.
//
// A re-read carries no new information about where the eyelid was.
// docs/blink-sample-rate.txt models what that costs and predicts what
// this module should find; this is the instrument that will decide
// whether that prediction was right. The same file already refuses
// this mistake for CLIPS, driving them from the decoded frames
// themselves rather than from the display's tick.
//
// Three numbers, from two event streams the page can already see:
//
//   delivered   how fast frames arrived from the camera
//   sampled     how many DISTINCT delivered frames the detector read
//   read share  what fraction of what arrived was ever looked at
//
// Pure, as everything that decides anything here is. Attaching the
// delivery callback to a video element is io/frameLoop.ts's job.

/**
 * How much history the rates are measured over.
 *
 * Bounded by TIME rather than by sample count, which is the rule the
 * sparkline learned the hard way: a buffer capped at a number of
 * samples holds a different DURATION at every frame rate, so it
 * silently shortened on fast machines. Five seconds is long enough
 * that one dropped frame does not move the answer and short enough
 * that a camera which stops delivering is noticed quickly.
 */
export const DELIVERY_WINDOW_MS = 5000;

/** One processing tick, and how many frames had arrived by then. */
type Read = {
  atMs: number;
  /**
   * The number of frames delivered when this tick ran, which names
   * WHICH frame it read: two ticks carrying the same count read the
   * same photograph, however far apart they are.
   */
  deliveredCount: number;
};

export type DeliveryState = {
  /** When each delivered frame arrived, inside the window. */
  deliveredAtMs: readonly number[];
  /** Every processing tick inside the window, and what it read. */
  reads: readonly Read[];
  /** Frames delivered since the session began, which never resets. */
  deliveredCount: number;
};

export function emptyDelivery(): DeliveryState {
  return { deliveredAtMs: [], reads: [], deliveredCount: 0 };
}

/** A frame arrived from the camera. */
export function noteDelivered(
  state: DeliveryState,
  nowMs: number,
): DeliveryState {
  return {
    deliveredAtMs: [
      ...keepRecent(state.deliveredAtMs, nowMs, DELIVERY_WINDOW_MS),
      nowMs,
    ],
    reads: state.reads.filter((r) => nowMs - r.atMs <= DELIVERY_WINDOW_MS),
    deliveredCount: state.deliveredCount + 1,
  };
}

/** The detector ran, reading whichever frame arrived most recently. */
export function noteRead(state: DeliveryState, nowMs: number): DeliveryState {
  return {
    ...state,
    deliveredAtMs: keepRecent(state.deliveredAtMs, nowMs, DELIVERY_WINDOW_MS),
    reads: [
      ...state.reads.filter((r) => nowMs - r.atMs <= DELIVERY_WINDOW_MS),
      { atMs: nowMs, deliveredCount: state.deliveredCount },
    ],
  };
}

export type DeliveryRates = {
  /** Frames per second the camera handed over. Null until measurable. */
  deliveredFps: number | null;
  /**
   * Distinct delivered frames the detector read, per second. This is
   * the rate that bounds what could have been seen: it can never
   * exceed `deliveredFps`, however fast the machine runs.
   */
  sampledFps: number | null;
  /**
   * `sampledFps` over `deliveredFps`. Below one on a machine slower
   * than its camera; at one on a machine faster than it. Deliberately
   * NOT clamped: a value a shade over one means the two rates were
   * measured across slightly different spans, and hiding that behind a
   * clamp would turn a measurement artefact into a claim.
   */
  readFraction: number | null;
};

/**
 * The three rates as of `nowMs`.
 *
 * Every one of them is null rather than zero when it cannot be
 * measured: no delivery callback in this browser, a session a frame
 * old, or a camera that has stopped. A zero would be a claim that the
 * camera delivered nothing, which is a different thing from not
 * knowing what it delivered.
 */
export function deliveryRates(
  state: DeliveryState,
  nowMs: number,
): DeliveryRates {
  const delivered = keepRecent(state.deliveredAtMs, nowMs, DELIVERY_WINDOW_MS);
  const reads = state.reads.filter((r) => nowMs - r.atMs <= DELIVERY_WINDOW_MS);
  const deliveredFps = measureFps(delivered);

  // Distinct photographs, not ticks. Two ticks that read the same
  // frame are one observation of the eye, and counting them as two is
  // exactly the overstatement this module exists to correct.
  const distinct = new Set(reads.map((r) => r.deliveredCount)).size;
  const first = reads[0];
  const last = reads[reads.length - 1];
  const spanMs =
    first === undefined || last === undefined ? 0 : last.atMs - first.atMs;
  const sampledFps =
    distinct < 2 || spanMs <= 0 ? null : ((distinct - 1) * 1000) / spanMs;

  const readFraction =
    deliveredFps === null || sampledFps === null || deliveredFps <= 0
      ? null
      : sampledFps / deliveredFps;

  return { deliveredFps, sampledFps, readFraction };
}

/**
 * The line the page shows beside the processing rate.
 *
 * It prints the two numbers as FRAMES rather than as a percentage,
 * because the gap between them is the thing worth seeing: a viewer
 * whose machine reads 24 of the 30 frames it is handed is the one
 * viewer for whom a faster computer really would count more blinks,
 * and until now the page could not tell them apart from a viewer whose
 * machine reads all 30 and is limited by the camera instead.
 *
 * A browser with no delivery callback says so. Showing nothing there
 * would take a limitation out of the open on exactly the devices where
 * it cannot be checked, which is the wrong direction for this project.
 */
export function deliveryRateMessage(rates: DeliveryRates): string {
  if (rates.deliveredFps === null) {
    return "Camera delivery: this browser does not report it";
  }
  if (rates.sampledFps === null) {
    return "Camera delivery: measuring...";
  }
  return (
    `Camera delivery: ${String(Math.round(rates.deliveredFps))} frames ` +
    `per second, of which this instrument read ` +
    `${String(Math.round(rates.sampledFps))}`
  );
}
