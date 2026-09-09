import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.0f1 [E2]. Until this row the page had no keydown handler
// at all, and three of its screens covered the whole viewport and
// closed on a mouse click only. A visitor working by keyboard who
// opened the gaze calibration was behind a black sheet with no way
// back: the overlay takes no focus, so Tab moves through a page nobody
// can see, and the only exit was a click they were not making.
//
// So Escape closes them, and the KSS dialog is deliberately NOT among
// them. A native <dialog> cancels on Escape for free, which is the
// wrong behaviour here: every way out of that question records an
// answer, and a dismissal that recorded nothing would leave a session
// unable to say whether the question was declined or never asked. The
// cancel is intercepted, and this file watches that it stays
// intercepted.

const PROFILE_KEY = "blinklab-calibration-profile-v1";

test("Escape closes the gaze calibration overlay", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  const calibrate = page.getByRole("button", { name: "Calibrate gaze" });
  await expect(calibrate).toBeVisible();
  await calibrate.click();

  const overlay = page.getByTestId("calibration-overlay");
  await expect(overlay).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
});

test("Escape closes the heatmap overlay", async ({ page }) => {
  // The returning visitor, the same seed the heatmap button's own spec
  // uses: a solved profile in storage is what enables the button, and
  // a fake camera never solves one.
  await page.addInitScript((key: string) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        horizontal: { slope: 1, intercept: 0 },
        vertical: { slope: 1, intercept: 0 },
      }),
    );
  }, PROFILE_KEY);
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  const heatmap = page.getByRole("button", { name: "Gaze heatmap" });
  await expect(heatmap).toBeEnabled({ timeout: 30_000 });
  await heatmap.click();

  const overlay = page.getByTestId("heatmap-overlay");
  await expect(overlay).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
});

test("Escape does not dismiss the sleepiness question", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();

  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeVisible({ timeout: 30_000 });

  // A native dialog would close here. The interceptor is the only
  // reason it does not, so pressing twice proves the handler holds
  // rather than the first press landing somewhere else.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(skip).toBeVisible();

  // And the ordinary way out still works, so the interceptor did not
  // seal the dialog shut.
  await skip.click();
  await expect(skip).toBeHidden();
});

test("the question opens with Skip focused and keeps focus inside", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();

  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeVisible({ timeout: 30_000 });

  // Skip rather than the first rating, and the reason is the file the
  // answer ends up in. A modal focuses its first focusable element by
  // default, which here is "1 Extremely alert", so a reflexive Enter
  // would write a sleepiness label nobody meant into an exported CSV.
  // Skip records a declining, which is true.
  await expect(skip).toBeFocused();

  // The focus trap, stated as what it actually guarantees rather than
  // as what the phrase suggests. Two things were measured in this
  // Chromium before this was written. One: the cycle passes through
  // <body> with nothing focused, so "always inside the dialog" is
  // false. Two: everything outside a modal dialog is inert, which
  // takes it out of the accessibility tree entirely — so a role-based
  // locator for a control behind the dialog finds nothing whether the
  // trap works or not, and asserting on one would be a test that
  // cannot fail.
  //
  // What is left is the real property: focus lands inside the dialog
  // or nowhere, never on an element of the page behind it.
  for (let press = 0; press < 6; press++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => {
      const active = document.activeElement;
      if (active === null || active === document.body) {
        return "body";
      }
      return document
        .querySelector("[data-testid='kss-dialog']")
        ?.contains(active)
        ? "dialog"
        : (active.textContent ?? active.tagName);
    });
    expect(
      ["dialog", "body"],
      `Tab ${String(press + 1)} left the dialog`,
    ).toContain(where);
  }
  // And it comes back rather than parking on body: six presses around
  // a ten-rating dialog end inside it.
  expect(
    await page.evaluate(() =>
      document
        .querySelector("[data-testid='kss-dialog']")
        ?.contains(document.activeElement),
    ),
  ).toBe(true);
});
