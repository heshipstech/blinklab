import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.2's first Check clause, verbatim: a no-face fake camera
// renders the refusal sentences verbatim, never "0". The fake camera
// delivers a test pattern with nobody in it, so the score can never
// exist, and the podium must say so in the score readout's own words
// — the identical string, from the identical function
// (src/core/scoreSentence.ts), which is the second clause held by
// construction and asserted here against the rendered page.

test("the podium speaks the refusal verbatim and never a zero", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // The button arms once a feature record exists: there is nothing
  // to project before the session has measured a second.
  const open = page.getByTestId("podium-view-button");
  await expect(open).toBeEnabled({ timeout: 30_000 });
  await open.click();

  const overlay = page.getByTestId("podium-overlay");
  await expect(overlay).toBeVisible();

  // The refusal sentence, verbatim, from the shared function — and
  // no digit anywhere in it, so a projector can never show "0"
  // about an empty chair.
  const score = page.getByTestId("podium-score");
  await expect(score).toHaveText("Alertness score: no face in frame");

  // The caveat travels with the number at the same distance, in the
  // page's own words (src/core/notice.ts).
  const noticeText = await page.getByTestId("podium-notice").textContent();
  expect(noticeText).toContain("Demo, not a safety or medical device.");

  // Legible at distance, measured on the rendered element rather
  // than trusted to a stylesheet: the constants the unit test floors
  // are the sizes the browser actually computed.
  const noticeSize = await page
    .getByTestId("podium-notice")
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(noticeSize).toBeGreaterThanOrEqual(24);
  const scoreSize = await page
    .getByTestId("podium-score")
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(scoreSize).toBeGreaterThanOrEqual(72);

  // Escape closes it: the register names the podium dismissible,
  // because closing a rendering of numbers already measured loses
  // nothing.
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
});
