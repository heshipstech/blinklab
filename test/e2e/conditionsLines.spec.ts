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

// Roadmap 14.0f2 [E7]. The sentences cited their evidence as bare
// paths, on a page served from a domain where a repository path means
// nothing. The honesty apparatus was one click away and the click did
// not exist.
test("each cited document is a link pinned to the build's commit", async ({
  page,
}) => {
  await page.goto("./");

  const citation = page.getByRole("link", { name: "docs/sampling-bounds.txt" });
  await expect(citation).toBeVisible();

  // Pinned to a commit rather than to a branch: a link to main shows a
  // reader today's document beside a number measured last week, which
  // is the same class of defect as a stale figure. A preview build
  // stamps "dev" and falls back to main, which is what this assertion
  // allows for.
  const href = await citation.getAttribute("href");
  // The alternation is GROUPED. Written flat, `|` splits the whole
  // pattern and the assertion passes on any string ending in the path,
  // which is a test that cannot fail for the reason it was written.
  expect(href).toMatch(
    /^https:\/\/github\.com\/[^/]+\/blinklab\/blob\/(?:[0-9a-f]{7,40}|main)\/docs\/sampling-bounds\.txt$/,
  );

  // The sentence around the link is unchanged. Turning a citation into
  // an anchor must not be a way to edit a sentence core owns.
  await expect(
    page.getByText("the sampling term is at most ±0.002"),
  ).toBeVisible();
});

test("the page links its own source, and says what it is", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("link", { name: "Source code on GitHub" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /eye signal laboratory/,
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /favicon\.svg$/,
  );
});
