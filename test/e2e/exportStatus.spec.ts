import { expect, test } from "@playwright/test";

// The owner reported "Export CSV doesn't work". It worked: the first
// click on a camera session opens the sleepiness question and returns,
// and the file arrives once the question is answered. Nothing on the
// page said so, and the marks line added just above the question had
// pushed it further down the box.
//
// This pins the sequence a person actually sees, because the unit tests
// own the sentences but not the moment they appear.

test("the export says it is waiting, then confirms the file by name", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();

  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled({ timeout: 30_000 });

  const status = page.getByTestId("export-status");
  // Nothing claimed before anything is claimed.
  await expect(status).toHaveText("");

  const download = page.waitForEvent("download");
  await exportCsv.click();

  // The click that used to look like nothing.
  await expect(status).toContainText("sleepiness question");

  // Answering completes it, and the confirmation names the file so a
  // person can go and look for it rather than guess.
  await page.getByRole("button", { name: "Skip" }).click();
  const file = await download;
  await expect(status).toContainText(file.suggestedFilename());
  await expect(status).toContainText("downloads");
});

test("the blink log refuses by name when no blink was ever seen", async ({
  page,
}) => {
  // The fake camera has no face, so no blink can be detected. The
  // button stays disabled, which is the honest state: there is nothing
  // to export and the page says so by not offering it.
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByTestId("export-csv")).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId("export-blinks")).toBeDisabled();
});
