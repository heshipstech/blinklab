import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// The first end to end test: the calibration flow, driven through the
// real built app in a headless browser with a fake camera. The fake
// stream has no face, so samples can never collect. What this proves
// is the WIRING: camera starts, the overlay opens on the first target,
// one click cancels, and a cancelled run stores nothing. The capture
// and solver math stay covered by their unit tests.
test("the calibration flow opens on dot 1 of 9 and cancels cleanly", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness measurement demo" }),
  ).toBeVisible();

  // The fake permission flag grants this without any prompt.
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Camera running: the calibrate button joins the page.
  const calibrate = page.getByRole("button", { name: "Calibrate gaze" });
  await expect(calibrate).toBeVisible();

  // Opening the overlay needs the landmarker loaded and one frame
  // loop tick, so the model and WASM download from our own preview
  // server first. Generous timeout: CI machines are slow.
  await calibrate.click();
  await expect(
    page.getByText("Follow the dot (1/9). Click anywhere to cancel."),
  ).toBeVisible({ timeout: 30_000 });

  // The dot sits on the first of the nine known targets.
  const dot = page.getByTestId("calibration-dot");
  await expect(dot).toBeVisible();
  expect(await dot.evaluate((el) => el.style.left)).toBe("10%");
  expect(await dot.evaluate((el) => el.style.top)).toBe("10%");

  // One click anywhere cancels, as 5.4a promised.
  await page.getByTestId("calibration-overlay").click();
  await expect(page.getByText("Follow the dot", { exact: false })).toBeHidden();

  // A cancelled run must leave no trace: the button still offers a
  // first calibration, and no profile reached local storage.
  await expect(calibrate).toBeVisible();
  const storedProfile = await page.evaluate(() =>
    localStorage.getItem("blinklab-calibration-profile-v1"),
  );
  expect(storedProfile).toBeNull();
});

test("the demo notice is visible on load and cannot be dismissed", async ({
  page,
}) => {
  // The ladder's check for 6.9. It must be there BEFORE any camera
  // permission, so a visitor who never starts the camera still sees
  // it, and no interaction may remove it.
  await page.goto("/blinklab/");
  const notice = page.getByTestId("demo-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("not a safety or medical device");
  await expect(notice).toContainText("never leave your browser");
  // The page used to promise nothing left the device at all, which was
  // false. It names the model's usage reporting now. See ADR-0004.
  await expect(notice).toContainText("usage statistics to Google");
  // Click it, click the page, and confirm it survives.
  await notice.click();
  await page.locator("body").click();
  await expect(notice).toBeVisible();
});

test("a returning visitor's stored profile re-enables the heatmap", async ({
  page,
}) => {
  // Remediation B5. The profile was loaded at startup and the button
  // refreshed once, but render's off-duty force-off then won and
  // nothing recomputed the button when a session began: only a fresh
  // solve did. So the heatmap, and the scanpath replay behind it,
  // were unreachable on every visit after the first. The seed below
  // IS the returning visitor: a profile in storage before page load.
  await page.addInitScript(() => {
    localStorage.setItem(
      "blinklab-calibration-profile-v1",
      JSON.stringify({
        horizontal: { slope: 1, intercept: 0 },
        vertical: { slope: 1, intercept: 0 },
      }),
    );
  });
  await page.goto("./");
  const heatmap = page.getByRole("button", { name: "Gaze heatmap" });
  // Off duty the button stays off, profile or not: the overlay can
  // only accumulate gaze while a session runs.
  await expect(heatmap).toBeDisabled();
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  await expect(heatmap).toBeEnabled({ timeout: 30_000 });
  await expect(heatmap).toHaveText("Gaze heatmap");
});

test("a visitor who never calibrated keeps the explain-first label", async ({
  page,
}) => {
  // The other half, so the fix cannot rot into always-enabled: with
  // no stored profile the running session still offers calibration
  // first, and the label says why the button is off.
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  // The RUNNING barrier first. Review proved the assertion below
  // green against an always-enabled rot without it: sampled during
  // the requesting window, "disabled" is trivially true. Calibrate
  // is enabled exactly while a session runs, so this waits for the
  // moment the rot would fire.
  await expect(
    page.getByRole("button", { name: "Calibrate gaze" }),
  ).toBeEnabled({ timeout: 30_000 });
  const heatmap = page.getByRole("button", {
    name: "Gaze heatmap (calibrate first)",
  });
  await expect(heatmap).toBeDisabled();
});
