import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.4's page clauses, on the rendered page: the card is
// unreachable while the camera runs, and once a finished session
// prints it, the demo notice prints with it and the rest of the page
// does not. The parity clause lives in test/core/reportCard.test.ts
// against the pure model; here the subject is the print machinery —
// emulateMedia({media:"print"}) applies the stylesheet's @media
// print rules, so the assertions read the same layout the printer
// would be handed.

test("the report card prints alone, notice and strip aboard, never mid-session", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // The real dialog would hang a headless run. The stub removes only
  // the dialog: populating the card and marking <body> are the
  // click's observable half, and they are what the assertions read.
  await page.addInitScript(() => {
    window.print = () => {
      // The dialog is the browser's; everything this page does
      // around it stays real and asserted below.
    };
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Unreachable while the camera runs: the button is off while
  // something is being measured, and print media carries no card —
  // a mid-session Ctrl+P gets the ordinary page.
  const printCard = page.getByTestId("print-report-card");
  const card = page.getByTestId("report-card");
  await expect(page.getByTestId("export-csv")).toBeEnabled({
    timeout: 30_000,
  });
  await expect(printCard).toBeDisabled();
  await page.emulateMedia({ media: "print" });
  await expect(card).toBeHidden();
  await page.emulateMedia({ media: null });

  await page.getByTestId("stop-camera").click();
  await expect(page.getByText("How sleepy do you feel now?")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Skip" }).click();

  // The session has ended, so the card arms with the report.
  await expect(printCard).toBeEnabled();
  await printCard.click();

  // On screen the card stays invisible even now: the print dialog is
  // its only viewport, and the page never grows a second on-screen
  // report to keep in step with the first.
  await expect(card).toBeHidden();

  // In print media the card IS the page: the demo notice prints, in
  // the page's own words, and the screen's controls do not print
  // around it.
  await page.emulateMedia({ media: "print" });
  await expect(card).toBeVisible();
  const notice = page.getByTestId("report-card-notice");
  await expect(notice).toBeVisible();
  const noticeText = await notice.textContent();
  expect(noticeText).toContain("Demo, not a safety or medical device.");
  await expect(page.getByTestId("show-report")).toBeHidden();

  // 14.1's strip rides the card, one canvas, blitted not repainted.
  await expect(card.locator("canvas")).toHaveCount(1);
});
