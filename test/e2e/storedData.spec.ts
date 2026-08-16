import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Remediation E3. Two keys were written to the visitor's browser from
// the first calibration onwards, nothing on the page said so, and
// there was no way to erase them from inside the app.
//
// The unit tests own the sentences. What these own is the WIRING, and
// one thing only an end to end test can prove: that erasing clears the
// profile the running session is holding IN MEMORY, not just the copy
// in storage.

const PROFILE_KEY = "blinklab-calibration-profile-v1";
const SAMPLES_KEY = "blinklab-calibration-samples-v1";

test("erasing empties the storage and takes the live profile with it", async ({
  page,
}) => {
  // The returning visitor: both keys present before the page loads.
  await page.addInitScript(
    ([profileKey, samplesKey]: string[]) => {
      localStorage.setItem(
        profileKey ?? "",
        JSON.stringify({
          horizontal: { slope: 1, intercept: 0 },
          vertical: { slope: 1, intercept: 0 },
        }),
      );
      localStorage.setItem(samplesKey ?? "", JSON.stringify([]));
    },
    [PROFILE_KEY, SAMPLES_KEY],
  );
  await page.goto("./");

  await expect(
    page.getByText("Stored on this device now: 2 of 2."),
  ).toBeVisible();

  // The session must be RUNNING before the heatmap assertion below
  // means anything. Off duty the button is forced off whatever the
  // profile says, so asserting "disabled" after an erase would pass
  // against a fix that never cleared the in-memory profile at all.
  // That is remediation B5's lesson, and it applies in reverse here.
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  const heatmap = page.getByRole("button", { name: "Gaze heatmap" });
  await expect(heatmap).toBeEnabled({ timeout: 30_000 });

  // One click arms, it does not erase. Losing a calibration to a
  // stray click would cost the visitor the nine dots.
  const erase = page.getByTestId("erase-stored-data");
  await erase.click();
  await expect(erase).toHaveText("Click again to erase it");
  expect(
    await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY),
  ).not.toBeNull();

  // The second click does it.
  await erase.click();
  await expect(page.getByTestId("erase-status")).toHaveText(
    "Erased. Nothing is stored on this device now.",
  );

  // Storage is really empty, read back from the browser rather than
  // believed from the page's own message.
  expect(
    await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY),
  ).toBeNull();
  expect(
    await page.evaluate((k) => localStorage.getItem(k), SAMPLES_KEY),
  ).toBeNull();

  // And the running session let go of it too: the heatmap is out of
  // reach again and the button offers a first calibration, not a
  // recalibration.
  await expect(heatmap).toBeDisabled();
  await expect(heatmap).toHaveText("Gaze heatmap (calibrate first)");
  await expect(
    page.getByRole("button", { name: "Calibrate gaze" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing is stored on this device."),
  ).toBeVisible();
});

test("a device with nothing stored says so, and offers nothing to erase", async ({
  page,
}) => {
  // The other half, so the control cannot rot into always-enabled.
  await page.goto("./");
  await expect(
    page.getByText("Nothing is stored on this device."),
  ).toBeVisible();
  const erase = page.getByTestId("erase-stored-data");
  await expect(erase).toBeDisabled();
  await expect(erase).toHaveText("Erase stored data (nothing stored)");
  // The enumeration is present whether or not anything is stored: it
  // describes what this page WOULD keep, which is the part a visitor
  // wants before they calibrate rather than after.
  await expect(page.getByText(PROFILE_KEY, { exact: false })).toBeVisible();
  await expect(page.getByText(SAMPLES_KEY, { exact: false })).toBeVisible();
});
