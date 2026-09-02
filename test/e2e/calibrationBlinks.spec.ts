import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// The guided blink calibration, driven through the real built app in a
// headless browser with a fake camera. As with the gaze flow, the fake
// stream has no face, so no aperture is ever measured. What that lets
// this prove is the WIRING and the refusal: the button is off until a
// source runs, one click opens the overlay on the open phase, the two
// timed phases run on the wall clock, and a run that gathered no trusted
// reading resolves to a refusal that stores nothing rather than a
// guessed line. The session state machine and the resolver keep their
// unit tests; the ready path needs a real face and lives in manual
// check land.

const BLINK_KEY = "blinklab-blink-calibration-v1";

test("the blink calibration opens, runs the phases, and refuses with no face", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // The button joins the page only while a source runs, the same rule
  // as the gaze calibration. The model and WASM download from our own
  // preview server first, so the wait is generous.
  const calibrate = page.getByTestId("calibrate-blinks");
  await expect(calibrate).toBeEnabled({ timeout: 30_000 });
  await expect(calibrate).toHaveText("Calibrate blinks");

  await calibrate.click();

  // The overlay opens and shows a phase instruction. Which phase is not
  // pinned here: each phase lasts only three seconds, so asserting the
  // OPEN phase specifically is a race under parallel load, and the
  // open-then-closed ORDER is already covered by the session state
  // machine's unit tests. Here it is enough that the overlay renders a
  // real phase instruction, and then reaches the refusal below.
  const overlay = page.getByTestId("blink-calibration-overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId("blink-calibration-instruction")).toHaveText(
    /eyes OPEN|CLOSE your eyes/,
  );

  // The two phases are three seconds each, driven by the wall clock. A
  // run that never saw a face gathers nothing, so it resolves to the
  // "not enough open" refusal. Wait for that terminal state.
  const status = page.getByTestId("blink-calibration-status");
  await expect(status).toBeVisible({ timeout: 20_000 });
  await expect(status).toContainText("did not get enough");
  await expect(overlay).toBeHidden();

  // A refusal is not a line: nothing reached storage, and the button
  // still offers a first calibration.
  expect(
    await page.evaluate((k) => localStorage.getItem(k), BLINK_KEY),
  ).toBeNull();
  await expect(calibrate).toHaveText("Calibrate blinks");
});

test("clicking to cancel a blink calibration stores nothing", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  const calibrate = page.getByTestId("calibrate-blinks");
  await expect(calibrate).toBeEnabled({ timeout: 30_000 });
  await calibrate.click();

  const overlay = page.getByTestId("blink-calibration-overlay");
  await expect(overlay).toBeVisible();

  // One click anywhere on the overlay cancels, the gaze flow's escape
  // hatch. A cancelled run leaves no trace.
  await overlay.click();
  await expect(overlay).toBeHidden();
  await expect(calibrate).toHaveText("Calibrate blinks");
  expect(
    await page.evaluate((k) => localStorage.getItem(k), BLINK_KEY),
  ).toBeNull();
});

test("a stored guided line is adopted as the detector's blink line", async ({
  page,
}) => {
  // Increment 3, the returning calibrated visitor: a stored guided line
  // present before the page loads. This is the one path the fake,
  // faceless camera CAN prove — that the stored line is loaded and
  // becomes the detector's line — because the baseline readout names
  // which line is in use, and it does so every running frame regardless
  // of a face. The blink-counting itself, needing a real closure, stays
  // in manual check 62.
  await page.addInitScript((k: string) => {
    localStorage.setItem(
      k,
      JSON.stringify({ personalLineMm: 5, openMedianMm: 8, closedMedianMm: 2 }),
    );
  }, BLINK_KEY);
  await page.goto("./");

  // The button already offers a RE-calibration, from storage, before
  // the camera even starts.
  await expect(page.getByTestId("calibrate-blinks")).toHaveText(
    "Recalibrate blinks",
  );

  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // The detector's own readout names the guided line as its threshold,
  // not the half-of-baseline default: the stored line reached the
  // detector, not just the button label.
  await expect(page.getByTestId("blink-threshold")).toHaveText(
    /from your guided calibration/,
    { timeout: 30_000 },
  );
});
