import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 13.7's Playwright clause: the fake camera answers the
// probe's three asks with whatever it grants, the menu renders one
// row per GRANT (never per ask), and the mode chosen from it rides
// the export as `chosen_mode` with the menu row's own label — the
// negotiated truth, so the file can never claim a mode the camera
// did not grant.

test("the probe renders granted modes and the export carries the choice", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  const probe = page.getByTestId("mode-probe");
  await expect(probe).toBeVisible();
  await probe.click();

  const menu = page.getByTestId("mode-menu");
  await expect(menu).toBeVisible();
  const chooseButtons = menu.getByRole("button", { name: /^Use / });
  await expect(chooseButtons.first()).toBeVisible();

  // Rows are keyed by what negotiation delivered, so however the
  // fake camera answers, three asks can never render more than
  // three rows, and every label is the negotiated truth.
  const rowCount = await chooseButtons.count();
  expect(rowCount).toBeGreaterThanOrEqual(1);
  expect(rowCount).toBeLessThanOrEqual(3);

  await chooseButtons.first().click();
  const confirmation = menu.getByText(/Mode chosen: /);
  await expect(confirmation).toBeVisible();
  const spoken = (await confirmation.textContent()) ?? "";
  const chosen = spoken.replace("Mode chosen: ", "").replace(/\.$/, "");
  expect(chosen.length).toBeGreaterThan(0);

  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled({ timeout: 30_000 });
  const download = page.waitForEvent("download");
  await exportCsv.click();
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible()) {
    await skip.click();
  }
  const stream = await (await download).createReadStream();
  const csv = await new Promise<string>((resolve, reject) => {
    let text = "";
    stream.on("data", (chunk: unknown) => (text += String(chunk)));
    stream.on("end", () => resolve(text));
    stream.on("error", reject);
  });
  expect(csv).toContain(`# chosen_mode: ${chosen}`);
});
