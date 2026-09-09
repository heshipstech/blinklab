// Roadmap 14.0f1 [E2]. Which of the things the page raises over
// itself the Escape key may close.
//
// The page raises five such screens and, before this row, exactly ONE
// of them could be left with a key. Row 14.0b gave the light stimulus
// its own Escape listener because a fullscreen flash somebody cannot
// dismiss is frightening, and that was right — but it was a listener
// for that overlay, written beside that overlay, and nothing carried
// it to the other three. So a visitor working by keyboard who opened
// the gaze calibration was behind a black sheet with no way back: the
// overlay takes no focus, so Tab walks through a page nobody can see,
// and the only exit was a click they were not making.
//
// The escape hatch existed. What was missing was anything that made
// the next overlay inherit it. So it becomes a list. The interesting part is the one it must NOT
// close, and that is why this is a list rather than a line of wiring:
// the sleepiness question is a modal whose every exit records an
// answer, Skip included, and a dismissal that recorded nothing would
// leave a session's file unable to say whether the question was
// declined or never asked. A native `<dialog>` cancels on Escape for
// free, which is exactly the wrong default here, so the page
// intercepts that cancel — and it reads WHICH dialogs to intercept
// from this list rather than from a comment.
//
// One list, two consumers: the keydown handler and the cancel
// interceptor. They cannot disagree about what "escapable" means
// because there is only one place that says.

/** Every full-viewport thing the page can raise over itself. */
export type OverlayId =
  | "calibration-overlay"
  | "blink-calibration-overlay"
  | "heatmap-overlay"
  | "light-overlay"
  | "kss-dialog";

export type Overlay = {
  id: OverlayId;
  /** Whether Escape may close it. */
  dismissible: boolean;
  /**
   * Why, in the words a reader of this file needs. A boolean alone
   * would make the KSS entry look like an oversight to the next person
   * who tidies this list.
   */
  because: string;
};

/**
 * The register, in the order the page builds them.
 *
 * `uiGuard` holds this list to `src/main.ts` in both directions, so an
 * overlay added to the page without an entry here goes red, and an
 * entry naming an overlay the page no longer builds goes red too. That
 * matters more than it sounds: the failure of a missing entry is a
 * screen a keyboard cannot leave, which nobody notices with a mouse in
 * their hand.
 */
export const OVERLAYS: readonly Overlay[] = [
  {
    id: "calibration-overlay",
    dismissible: true,
    because:
      "the gaze calibration stores nothing until all nine targets are " +
      "captured, so leaving it early loses a partial run and no answer",
  },
  {
    id: "blink-calibration-overlay",
    dismissible: true,
    because:
      "a cancelled blink calibration stores nothing, the same escape " +
      "hatch the click already offered and the keyboard did not have",
  },
  {
    id: "heatmap-overlay",
    dismissible: true,
    because:
      "the heatmap is a view of gaze already accumulated, so closing it " +
      "discards a picture and never a measurement",
  },
  {
    id: "light-overlay",
    dismissible: true,
    because:
      "a fullscreen flash somebody cannot dismiss is frightening, which " +
      "row 14.0b already knew: this is that overlay's own listener, kept " +
      "and moved into the list so the next overlay inherits it",
  },
  {
    id: "kss-dialog",
    dismissible: false,
    because:
      "every way out of the sleepiness question records an answer and " +
      "Skip is one of them; a dismissal that recorded nothing would " +
      "leave a session unable to say whether the question was declined " +
      "or never asked, which is the difference between a missing label " +
      "and a refused one",
  },
];

/**
 * The register's entry for an id.
 *
 * Throws on an id it does not hold rather than returning a default.
 * A default would have to guess `dismissible`, and both guesses are
 * bad: guessing true lets a recording modal be dismissed silently,
 * guessing false traps a keyboard behind a screen. The type makes the
 * unknown id unreachable from this repository's own callers; the throw
 * is for the case where the type has been widened and this list has
 * not.
 */
export function overlayById(id: OverlayId): Overlay {
  const found = OVERLAYS.find((overlay) => overlay.id === id);
  if (found === undefined) {
    throw new Error(
      `no overlay registered as "${id}". Escape's rule for a screen ` +
        "cannot be guessed: one guess dismisses a question that had to " +
        "record an answer, the other traps a keyboard behind a sheet",
    );
  }
  return found;
}

/**
 * Whether an open screen refuses Escape, so the key must be CONSUMED
 * rather than merely ignored.
 *
 * This is not tidiness, it is the only thing that works. A native
 * `<dialog>` fires `cancel` on Escape and honours `preventDefault()`
 * ON THE FIRST PRESS ONLY: without a user activation in between,
 * Chromium's close watcher fires cancel a second time, sees it
 * prevented again, and closes the dialog anyway. Measured in the same
 * Chromium the end-to-end suite drives — cancel fired twice, then the
 * close event. So the refusal cannot live in the `cancel` handler. It
 * has to stop the key BEFORE a close request exists, which means
 * `preventDefault()` on the keydown while the question is up.
 *
 * When this is true the key does nothing at all, including to screens
 * behind the modal one: they are unreachable while it is up, and doing
 * something with a press this project has declared inert would be a
 * second rule nobody asked for.
 */
export function escapeBlocked(open: readonly OverlayId[]): boolean {
  return open.some((id) => !overlayById(id).dismissible);
}

/**
 * The overlays Escape closes, given the ones currently open.
 *
 * Every open dismissible one, not the topmost. Two of these are never
 * open together today, and a rule that quietly closed one of two would
 * be a rule nobody could see was wrong until the day it mattered.
 *
 * Nothing at all while `escapeBlocked` holds, per the reasoning there.
 *
 * Returned in the register's order rather than the caller's, and once
 * each, so the page's handler does the same thing however it happens
 * to enumerate its own elements.
 */
export function escapeCloses(open: readonly OverlayId[]): OverlayId[] {
  if (escapeBlocked(open)) {
    return [];
  }
  const isOpen = new Set(open);
  return OVERLAYS.filter(
    (overlay) => overlay.dismissible && isOpen.has(overlay.id),
  ).map((overlay) => overlay.id);
}
