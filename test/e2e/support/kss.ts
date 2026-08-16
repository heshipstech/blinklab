import type { Page } from "@playwright/test";

/**
 * Answer the opening sleepiness question, if it is asked.
 *
 * Starting a camera asks it, and since 16 August it asks as a MODAL
 * over a dimmed page rather than a panel inside the Session card. That
 * is the point of the change: the export waits on an answer, and as a
 * panel low in a scrollable card the question could be missed entirely,
 * so a person clicking Export and seeing nothing move reported the
 * button as broken when it was only waiting.
 *
 * The consequence for these tests is that the modal now blocks the page
 * until answered, exactly as it blocks a person. Every spec that starts
 * a camera and then touches anything has to get past it first, so the
 * step lives here rather than being copied seven times and drifting.
 *
 * Skip rather than a rating: these specs are about wiring, and an
 * invented sleepiness answer would be written into an exported file as
 * though someone had meant it.
 */
export async function answerOpeningQuestion(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "Skip" });
  try {
    await skip.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    // The question is only asked once a session is actually running, so
    // a run that fails before that never asks and there is nothing to
    // dismiss. The model-failure specs are exactly that case.
    //
    // Swallowing the wait cannot hide a regression that matters: if the
    // dialog stopped appearing when it should, every later click in
    // that spec would be fine and the spec's own assertions would fail
    // on the missing answer instead.
    return;
  }
  await skip.click();
}
