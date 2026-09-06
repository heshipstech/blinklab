import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// The unit tests own the schedule itself (test/core/lightSchedule.test.ts:
// which phase shows when, and the exact metadata rows). This owns the
// wiring only a real browser answers: that clicking "Light response"
// raises the stimulus overlay and paints a phase from that schedule, and
// that the schedule and its start reach the exported file — so the
// analysis can sort each recorded second into dark or bright.
//
// It does NOT wait out the 260-second run; the phase progression is a
// pure function pinned by the unit tests. What a browser has to prove is
// that the overlay is driven by that function and the export carries the
// start.

test("the light-response stimulus starts and its schedule reaches the export", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Records arrive about once a second, and the stimulus rides the same
  // gate as the exports: nothing to measure a reflex against until a
  // record exists.
  const light = page.getByTestId("light-response");
  await expect(light).toBeEnabled({ timeout: 30_000 });
  await light.click();

  // The overlay is up and painting a phase from the schedule. The first
  // twenty seconds are the discarded settle, shown dark.
  const overlay = page.getByTestId("light-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("data-phase", "settle");

  // A real run ends itself after 260 s; the test ends it early with Esc,
  // and the start stays logged so the export still records that a
  // stimulus happened.
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();

  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled();
  const download = page.waitForEvent("download");
  await exportCsv.click();
  // The closing sleepiness question gates the first export.
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

  // The schedule travels with the readings, and the start is a real
  // number the analysis subtracts from each row's timestampMs.
  expect(csv).toContain("# light_stimulus: ");
  expect(csv).toContain("# light_settle_ms: 20000");
  expect(csv).toContain("# light_phase_ms: 20000");
  expect(csv).toContain("# light_cycles: 6");
  expect(csv).toMatch(/# light_stimulus_start_ms: [0-9]/);
});

test("without fullscreen the stimulus still runs, and a tap ends it", async ({
  page,
}) => {
  // Roadmap 14.0b (audit A6). Browsers that expose no
  // requestFullscreen (an iPhone's Safari) used to throw after the
  // black overlay was shown: the schedule never started, and a phone
  // had no exit but a reload, which discards the session.
  await page.addInitScript(() => {
    delete (Element.prototype as { requestFullscreen?: unknown })
      .requestFullscreen;
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  const light = page.getByTestId("light-response");
  await expect(light).toBeEnabled({ timeout: 30_000 });
  await light.click();

  const overlay = page.getByTestId("light-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("data-phase", "settle");
  // The wording names the touch exit.
  await expect(page.getByTestId("light-message")).toContainText("Tap anywhere");
  // A tap, not a key, ends it.
  await overlay.click({ position: { x: 20, y: 20 } });
  await expect(overlay).toBeHidden();
});
