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
  /**
   * When that photograph arrived, or null before any had. Roadmap
   * 10.16, ladder A27: the two rates are compared, so they have to be
   * counted over one span, and a frame read inside the span but
   * DELIVERED before it is not a frame the span can be credited with.
   * Without this the sampled rate could exceed the delivered one.
   */
  frameAtMs: number | null;
};

export type DeliveryState = {
  /** When each delivered frame arrived, inside the window. */
  deliveredAtMs: readonly number[];
  /** Every processing tick inside the window, and what it read. */
  reads: readonly Read[];
  /** Frames delivered since the session began, which never resets. */
  deliveredCount: number;
  /**
   * When the last frame arrived, on the page clock, kept outside the
   * window so it survives the trimming. Null until a first frame:
   * a camera that never delivered has not STOPPED delivering, and
   * the difference is the one this field exists for (roadmap 14.0d).
   */
  lastDeliveredAtMs: number | null;
};

export function emptyDelivery(): DeliveryState {
  return {
    deliveredAtMs: [],
    reads: [],
    deliveredCount: 0,
    lastDeliveredAtMs: null,
  };
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
    lastDeliveredAtMs: nowMs,
  };
}

/**
 * How long the camera has been silent, once that silence has outlasted
 * the window; null while frames are inside the window.
 *
 * Silence is measured from the last delivered frame, or, when no frame
 * was ever delivered, from the moment the page became able to receive
 * one. Without that moment there is nothing to measure from: a camera
 * that never started has not stopped, and "stale for 60 s" would claim
 * one that once worked.
 *
 * Roadmap 14.0d (audit A26): before this the drained window left a null
 * rate that the page rendered as the browser's inability to report,
 * and records went on being written from the frozen frame.
 */
export function deliveryStaleness(
  state: DeliveryState,
  nowMs: number,
  // Since when the page has been able to receive frames at all. A
  // hidden tab gets no delivery callbacks, so on return the silence
  // is the tab's, not the camera's, and it must not end the session:
  // that gap is already an interruption in the record. Staleness is
  // counted only once the page has been attentive for a whole window.
  attentiveSinceMs: number = Number.NEGATIVE_INFINITY,
): number | null {
  if (nowMs - attentiveSinceMs <= DELIVERY_WINDOW_MS) {
    return null;
  }
  const since =
    state.lastDeliveredAtMs ??
    (Number.isFinite(attentiveSinceMs) ? attentiveSinceMs : null);
  if (since === null) {
    return null;
  }
  const silentForMs = nowMs - since;
  return silentForMs > DELIVERY_WINDOW_MS ? silentForMs : null;
}

/** The detector ran, reading whichever frame arrived most recently. */
export function noteRead(state: DeliveryState, nowMs: number): DeliveryState {
  return {
    ...state,
    deliveredAtMs: keepRecent(state.deliveredAtMs, nowMs, DELIVERY_WINDOW_MS),
    reads: [
      ...state.reads.filter((r) => nowMs - r.atMs <= DELIVERY_WINDOW_MS),
      {
        atMs: nowMs,
        deliveredCount: state.deliveredCount,
        frameAtMs: state.lastDeliveredAtMs,
      },
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
   * than its camera; at one on a machine faster than it.
   *
   * It cannot exceed one, and it is not clamped to get there: since
   * roadmap 10.16 both rates count events inside ONE span, and the
   * frames read in that span are a subset of the frames delivered in
   * it, so the ratio is at most one by construction. Before that the
   * two were measured across different spans and a camera that sped up
   * mid-window could print reading 30 frames out of 10.
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

  const first = reads[0];
  const last = reads[reads.length - 1];
  const spanMs =
    first === undefined || last === undefined ? 0 : last.atMs - first.atMs;

  // No reads yet, so nothing to compare and nothing to get wrong: the
  // camera's own rate is measured over its own frames and the sampled
  // rate says nothing rather than zero.
  if (spanMs <= 0) {
    return {
      deliveredFps: measureFps(delivered),
      sampledFps: null,
      readFraction: null,
    };
  }

  // One span, from the first read to the last, and both numbers count
  // events inside it. Roadmap 10.16, ladder A27: measured over their
  // own spans the two rates answered different questions and were
  // printed as one, so a camera that sped up mid-window could read 30
  // frames out of 10.
  const spanStart = first?.atMs ?? 0;
  const spanEnd = last?.atMs ?? 0;
  const deliveredInSpan = delivered.filter(
    (atMs) => atMs >= spanStart && atMs <= spanEnd,
  ).length;

  // Distinct photographs, not ticks. Two ticks that read the same
  // frame are one observation of the eye, and counting them as two is
  // exactly the overstatement this module exists to correct. A read
  // whose frame arrived before the span is not counted either: the
  // span cannot be credited with a frame it did not receive.
  const distinctInSpan = new Set(
    reads
      .filter(
        (r) =>
          r.frameAtMs !== null &&
          r.frameAtMs >= spanStart &&
          r.frameAtMs <= spanEnd,
      )
      .map((r) => r.deliveredCount),
  ).size;

  // Intervals, not events, which is the convention measureFps already
  // uses: N frames inside a span cover N-1 gaps. Both numbers are
  // counted the same way, so the invariant survives it — a subset of
  // the frames gives a subset of the gaps.
  const deliveredFps =
    deliveredInSpan < 2 ? null : ((deliveredInSpan - 1) * 1000) / spanMs;
  const sampledFps =
    deliveredFps === null
      ? null
      : (Math.max(distinctInSpan - 1, 0) * 1000) / spanMs;
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
export type DeliveryObservation = {
  /** Whether a delivery callback is watching this source at all. */
  observed: boolean;
  /** deliveryStaleness() at the same moment, when observed. */
  staleForMs: number | null;
};

export function deliveryRateMessage(
  rates: DeliveryRates,
  observation: DeliveryObservation,
): string {
  // The browser's silence is only the browser's when nothing is
  // watching. An observed source with no rate is either not yet
  // measurable or has stopped, and those are different sentences
  // (roadmap 14.0d, audit A26).
  if (!observation.observed) {
    return "Camera delivery: this browser does not report it";
  }
  if (observation.staleForMs !== null) {
    return `Camera delivery: no frames in the last ${String(Math.round(DELIVERY_WINDOW_MS / 1000))} s`;
  }
  if (rates.deliveredFps === null || rates.sampledFps === null) {
    return "Camera delivery: measuring...";
  }
  // "3 per second, of which this instrument read 5" was a sentence
  // about nothing, and it was reachable because the two rates were
  // measured over different spans. They share a span now, so the
  // whole-of-part reading is always true, and the equal case gets its
  // own words rather than printing the same number twice (roadmap
  // 10.16, ladder A27).
  const delivered = Math.round(rates.deliveredFps);
  const sampled = Math.round(rates.sampledFps);
  if (sampled >= delivered) {
    return `Camera delivery: ${String(delivered)} frames per second, and this instrument read all ${String(delivered)}`;
  }
  return (
    `Camera delivery: ${String(delivered)} frames ` +
    `per second, of which this instrument read ` +
    `${String(sampled)}`
  );
}
