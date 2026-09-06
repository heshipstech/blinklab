import { expect, test } from "@playwright/test";

// Roadmap 14.0b (audit E1). On a phone the Start camera button sat
// below the fold, behind a score that said "measuring..." and five
// disabled exports. The Source box now comes first under 1000 px, and
// this spec runs only on the "phone" project, a 375-wide viewport.

test("on a phone the way in is on screen before anything scrolls", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness demo" }),
  ).toBeVisible();
  const start = page.getByRole("button", { name: "Start camera" });
  await expect(start).toBeInViewport();
  // The demo notice stays above everything, in view with the button.
  await expect(page.getByTestId("demo-notice")).toBeInViewport();
});
