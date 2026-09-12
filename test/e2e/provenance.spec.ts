import { expect, test } from "@playwright/test";

// Roadmap 14.3. The unit tests own the sentences and the guard owns
// the disk; what these own is the WIRING: that every readout on the
// real page carries its explain control, that clicking one speaks the
// status from the table rather than a stale copy, and that a citation
// renders as a link a visitor can actually follow to the committed
// document.

test("every readout explains itself, and the score names its evidence", async ({
  page,
}) => {
  await page.goto("./");
  // One control per rendered readout, the idle registry's sixteen.
  await expect(
    page.getByRole("button", { name: /^Explain this number: / }),
  ).toHaveCount(16);

  const note = page
    .getByTestId("provenance-note")
    .filter({ hasText: "AUC 0.70" });
  await expect(note).toBeHidden();

  const explain = page.getByRole("button", {
    name: "Explain this number: Alertness score",
  });
  await explain.click();
  await expect(note).toBeVisible();
  // The taxonomy first, then the row's own acceptance sentence: the
  // score is cohort-level and unvalidated per person.
  await expect(note).toContainText(
    "Measured: a committed result file backs this number.",
  );
  await expect(note).toContainText("unvalidated per person");
  // The citation is a real link, pinned to the commit the page was
  // built from ("main" on a local build, the sha in CI).
  await expect(
    note.getByRole("link", { name: "docs/alertness-score-result.txt" }),
  ).toHaveAttribute(
    "href",
    /\/blob\/[^/]+\/docs\/alertness-score-result\.txt$/,
  );

  // The same button closes it, and says so to a screen reader.
  await explain.click();
  await expect(note).toBeHidden();
  await expect(explain).toHaveAttribute("aria-expanded", "false");
});

test("the PERCLOS note refuses comparability in the visitor's face", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", {
      name: "Explain this number: PERCLOS (eyes closed share, last 60 s)",
    })
    .click();
  const note = page
    .getByTestId("provenance-note")
    .filter({ hasText: "not comparable to published PERCLOS" });
  await expect(note).toBeVisible();
  await expect(note).toContainText("blink time");
  await expect(note).toContainText("Convention");
});
