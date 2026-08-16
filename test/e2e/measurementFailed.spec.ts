import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Remediation B3. A throw inside the frame handler used to skip the
// loop's re-arm, so the page froze silently: every readout stuck on
// its last value, no message, records simply stopping. The loop now
// reports the crash once and stops on purpose, and this test is the
// audit's required check: inject one throw, then assert BOTH that a
// readable message appears AND that the record count stops
// advancing. The second half is what rules out the other wrong fix,
// a catch that silently resumes, which would keep the page looking
// healthy while the same throw repeated sixty times a second.

test("one throw in the frame loop stops measurement visibly and keeps the data", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Records must be provably ADVANCING first, or "stops advancing"
  // is vacuous. Two increasing numeric readings prove the session
  // records; matching the digits as text would race the ticker.
  const records = page
    .locator("p")
    .filter({ hasText: /Feature records: \d+ this session/ });
  const readCount = async (): Promise<number> =>
    Number(
      /Feature records: (\d+)/.exec((await records.textContent()) ?? "")?.[1] ??
        Number.NaN,
    );
  await expect(records).toBeVisible({ timeout: 90_000 });
  const firstCount = await readCount();
  await expect.poll(readCount, { timeout: 30_000 }).toBeGreaterThan(firstCount);

  // One throw, injected into the next drawn frame. The patch
  // restores the original before throwing, so if the loop wrongly
  // resumed, every later frame would draw fine and records would
  // keep climbing, which the assertions below would catch.
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function () {
      CanvasRenderingContext2D.prototype.drawImage = original;
      throw new Error("injected test failure");
    } as CanvasRenderingContext2D["drawImage"];
  });

  // The readable message, carrying the injected reason, promising
  // the data, asking for a reload.
  const message = page.getByText(
    "Measurement stopped because of an internal error",
  );
  await expect(message).toBeVisible({ timeout: 30_000 });
  await expect(message).toContainText("injected test failure");
  await expect(message).toContainText("kept");

  // The record count freezes. Sampled, a real wait, sampled again:
  // absence of change over time cannot be proven by a poll that
  // stops at its first success.
  const countNow = (await records.textContent()) ?? "";
  await page.waitForTimeout(3_000);
  expect((await records.textContent()) ?? "").toBe(countNow);

  // The kept promise is real: the export of everything recorded so
  // far is still offered.
  await expect(page.getByTestId("export-csv")).toBeEnabled();

  // And the camera path may not quietly rebuild the frozen page: a
  // dead loop refuses a new session with the same message.
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  await expect(message).toBeVisible();
  await expect(
    page.locator("p").filter({ hasText: /Processing rate: \d+/ }),
  ).toBeHidden();
});
