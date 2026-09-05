import { expect, test } from "@playwright/test";

// Roadmap 10.10b. The two conditions sentences are built in core and
// pinned there against their committed documents; this spec proves the
// wiring — that both actually stand on the page beside the numbers
// they scope, rather than existing only as tested strings. A created
// node that nobody appended would pass every unit test and never be
// seen, which is exactly the 9.4b lesson.

test("both conditions sentences render beside their numbers", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("floor, not a count")).toBeVisible();
  await expect(
    page.getByText("the sampling term is at most ±0.002"),
  ).toBeVisible();
});
