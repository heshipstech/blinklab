import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.0b (audit B19, E5). What the page says before and while
// nothing is measured: the short caveat stands beside the score, the
// idle page never claims a measurement in progress, and the camera
// path says the model is loading instead of going quiet.

test("the caveat stands beside the score, and idle says not measuring", async ({
  page,
}) => {
  await page.goto("./");
  const alertness = page.locator("#box-alertness");
  await expect(alertness).toContainText("not a safety or medical device");
  // Idle: not measuring, never "measuring..." and never a count.
  await expect(alertness).toContainText("Alertness score: not measuring");
  await expect(page.locator("#box-blinks")).toContainText(
    "Blinks: not measuring",
  );
  await expect(page.locator("body")).not.toContainText("measuring...");
});

test("the camera path says the model is loading, then the score's line counts down", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  // Said on the status line while the model downloads, on the camera
  // path as on the clip path.
  const status = page.locator("p[data-state]");
  await expect(status).toContainText(/Loading the measuring model/);
  // The countdown to the first score sits under the score itself.
  await expect(page.locator("#box-alertness")).toContainText(
    /Learning your open eyes: \d+ s left/,
    { timeout: 60_000 },
  );
});
