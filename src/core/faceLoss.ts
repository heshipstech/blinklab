// Roadmap 13.13. The detector recovers from a lost face instead of
// riding it to the end of a clip.
//
// The event this row exists for: on 8 September 2026 one run of six
// lost the glasses clip's face 39 seconds in and never reacquired it
// — faceDetected false to the end, inference at about a millisecond,
// recall 14.0% for a day. The wiring COASTED: no part of it treated
// a persistent loss as something to act on, so a wedged tracker
// state rode to the end of the clip. The owner accepted the
// fake-landmarker harness (no face from a chosen frame onward) as
// that event's stand-in, and this module is the decision half of the
// fix: a pure clock over faceDetected that escalates a PERSISTENT
// loss to a re-acquisition signal, keeps signalling while the loss
// continues, and carries the record of the worst stretch to the page
// and the export.
//
// Two distinctions the state machine is built on. A face NEVER FOUND
// is not a face LOST: the faceless fake camera and the committed
// no-face fixture are already honest, and resetting a landmarker
// that never acquired would thrash forever, so episodes begin only
// after a face has been seen. And a BLINK-LENGTH gap is not a loss:
// the escalation threshold sits far above any real blink, so the
// ordinary flicker of detection never fires it.

/**
 * How long a continuous loss runs before the wiring re-attempts
 * acquisition, and how often it re-attempts while the loss lasts. A
 * CHOICE, stated as one: two seconds is about sixty frames at the
 * common rate — sixty chances the tracker's own reacquisition has
 * already declined — and four times any real blink, so escalating
 * here is never mistaken for impatience with an eyelid.
 */
export const FACE_LOSS_RESET_MS = 2000;

/**
 * The stretch past which the loss is SAID out loud, on the page and
 * in the export. A CHOICE: the row's own words are "lost for more
 * than a few seconds", and five is a few with a margin — long
 * enough that no honest session hits it by flicker, short enough
 * that the 39-second event would have been named seven times over.
 */
export const FACE_LOSS_REPORT_MS = 5000;

export type FaceLossState = {
  /** First timestamp a face was ever trusted, or null. Episodes
   * exist only after this: a face never found is not a face lost. */
  everSeenMs: number | null;
  /** Start of the current continuous loss, or null when the face is
   * present (or was never seen). */
  lossStartMs: number | null;
  /** When a re-acquisition was last signalled in this episode. */
  lastResetMs: number | null;
  /** Re-acquisitions signalled this session. The wiring acts on each
   * signal; the count is the record of how often it had to. */
  resets: number;
  /** The longest continuous loss seen, ongoing or closed, in ms. */
  longestLossMs: number;
  lastTimestampMs: number;
};

export const INITIAL_FACE_LOSS: FaceLossState = {
  everSeenMs: null,
  lossStartMs: null,
  lastResetMs: null,
  resets: 0,
  longestLossMs: 0,
  lastTimestampMs: -Infinity,
};

export function faceLossStep(
  state: FaceLossState,
  timestampMs: number,
  faceDetected: boolean,
): { state: FaceLossState; resetDue: boolean } {
  if (timestampMs <= state.lastTimestampMs) {
    throw new Error(
      "faceLoss: timestamps must move strictly forward " +
        `(${String(timestampMs)} after ${String(state.lastTimestampMs)})`,
    );
  }
  if (faceDetected) {
    // Reacquisition closes the episode; the stretch is measured to
    // the frame the face came back on, because that is how long the
    // record actually went without one.
    const closed =
      state.lossStartMs === null
        ? state.longestLossMs
        : Math.max(state.longestLossMs, timestampMs - state.lossStartMs);
    return {
      state: {
        ...state,
        everSeenMs: state.everSeenMs ?? timestampMs,
        lossStartMs: null,
        lastResetMs: null,
        longestLossMs: closed,
        lastTimestampMs: timestampMs,
      },
      resetDue: false,
    };
  }
  if (state.everSeenMs === null) {
    return {
      state: { ...state, lastTimestampMs: timestampMs },
      resetDue: false,
    };
  }
  const lossStartMs = state.lossStartMs ?? timestampMs;
  const ongoingMs = timestampMs - lossStartMs;
  const sinceResetMs =
    state.lastResetMs === null ? ongoingMs : timestampMs - state.lastResetMs;
  const resetDue =
    ongoingMs >= FACE_LOSS_RESET_MS && sinceResetMs >= FACE_LOSS_RESET_MS;
  return {
    state: {
      ...state,
      lossStartMs,
      lastResetMs: resetDue ? timestampMs : state.lastResetMs,
      resets: resetDue ? state.resets + 1 : state.resets,
      longestLossMs: Math.max(state.longestLossMs, ongoingMs),
      lastTimestampMs: timestampMs,
    },
    resetDue,
  };
}

/**
 * The page's sentence, or null while there is nothing worth saying.
 * Null below the report threshold — a short loss is the record's
 * ordinary honesty, not an event — and past it the sentence names
 * the worst stretch and how often acquisition was re-attempted, so
 * a run that lost its face cannot finish looking like one that
 * never did.
 */
export function faceLossSentence(state: FaceLossState): string | null {
  if (state.longestLossMs < FACE_LOSS_REPORT_MS) {
    return null;
  }
  const seconds = (state.longestLossMs / 1000).toFixed(1);
  return (
    `Face lost for ${seconds} s at the longest stretch; acquisition ` +
    `re-attempted ${String(state.resets)} time(s). Rows in that ` +
    "stretch carry honest nulls."
  );
}

/**
 * The export's account, or nothing at all when no re-acquisition was
 * ever signalled — the pseudonym rule: an ordinary session does not
 * carry rows describing an event that did not happen.
 */
export function faceLossMetadataRows(state: FaceLossState): string[] {
  if (state.resets === 0) {
    return [];
  }
  return [
    `# face_lost_longest_ms: ${String(Math.round(state.longestLossMs))}`,
    `# face_reacquire_resets: ${String(state.resets)}`,
  ];
}
