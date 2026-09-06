import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.0a (audit F-015, F-056, F-057). The natural order, stop
// the camera and then export, used to lose the session: Stop dropped
// the page into idle, idle greyed both exports, and the next Start
// wiped the records under a comment that said they stayed exportable.
// The after question was never asked on that path, and on the export
// path it was asked again after a Skip. Ended is now a state of its
// own: the exports and the report survive it, the after question is
// asked exactly once on the transition, and the way back is offered.

test("stop then export keeps the session and asks the after question once", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Something recorded, or "kept" is vacuous. The marker and the
  // light stimulus are live on the same record gate.
  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled({ timeout: 30_000 });
  const mark = page.getByTestId("mark-moment");
  const light = page.getByTestId("light-response");
  await expect(mark).toBeEnabled();
  await expect(light).toBeEnabled();

  await page.getByTestId("stop-camera").click();

  // The after question arrives on the transition, not on a later
  // click, and the page says the session has ended.
  await expect(page.getByText("How sleepy do you feel now?")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Skip" }).click();
  // The status line itself, by its machine-readable state: the report
  // gate's label also says the session has ended, and a text match
  // would find both.
  await expect(page.locator('p[data-state="ended"]')).toBeVisible();
  await expect(page.locator('p[data-state="ended"]')).toContainText(
    "What it recorded is kept",
  );

  // What was recorded is still on offer: the export, and the report
  // that only renders once the session is over.
  await expect(exportCsv).toBeEnabled();
  await expect(page.getByTestId("show-report")).toBeEnabled();

  // What acts on a RUNNING measurement is off: there is no moment
  // left to mark, no live eye to flash, nothing to calibrate against.
  await expect(mark).toBeDisabled();
  await expect(light).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Calibrate gaze" }),
  ).toBeDisabled();

  // The export downloads without asking the question a second time
  // (a Skip is an answer), and confirms the file by name.
  const download = page.waitForEvent("download");
  await exportCsv.click();
  const file = await download;
  expect(file.suggestedFilename()).toContain("blinklab-session");
  await expect(page.getByRole("button", { name: "Skip" })).toBeHidden();

  // The way back.
  await expect(
    page.getByRole("button", { name: "Start camera" }),
  ).toBeVisible();
});
