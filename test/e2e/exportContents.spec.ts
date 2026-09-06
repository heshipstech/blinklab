import { expect, test } from "@playwright/test";

// Roadmap 10.0a2, ladder B2. The disclosure and the browser-string
// choice are built in core and pinned there against the metadata row
// builders; this spec proves the wiring — that both actually stand on
// the page beside the export buttons a person is about to press,
// rather than existing only as tested strings. A created node that
// nobody appended would pass every unit test and never be seen, which
// is the 9.4b lesson.

test("the export disclosure and the browser-string choice stand beside the exports", async ({
  page,
}) => {
  await page.goto("./");

  const note = page.getByTestId("export-contents");
  await expect(note).toBeVisible();
  // The three facts a reader would not guess from "one record per
  // second", and the one that decides whether they send the file.
  await expect(note).toContainText("the camera's label");
  await expect(note).toContainText("participant_pseudonym");
  await expect(note).toContainText("nothing is uploaded");

  // Both live in the Session box, where the export buttons are, not in
  // a footer nobody reads before clicking.
  await expect(
    page.locator("#box-session").getByTestId("export-contents"),
  ).toBeVisible();

  // Reduced is the default, and the full string is a deliberate act.
  const full = page.getByTestId("full-user-agent");
  await expect(full).not.toBeChecked();
  await expect(page.getByText("Full browser string in exports")).toBeVisible();
  await full.check();
  await expect(full).toBeChecked();
});
