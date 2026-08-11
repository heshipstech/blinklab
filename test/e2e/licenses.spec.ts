import { expect, test } from "@playwright/test";

// The audit found the PUBLISHED page carried no attribution for the
// Apache-2.0 material it redistributes. The unit tests prove the
// notice exists in the source tree; this proves the built site serves
// it, which is the only place the obligation is actually met. It runs
// against the same built-and-served output as every other end to end
// test, so a build that drops the file is a red build.

test("the licence notice ships beside the page", async ({ page }) => {
  const response = await page.request.get("/blinklab/THIRD_PARTY_LICENSES.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Apache License");
  expect(body).toContain("@mediapipe/tasks-vision");
  expect(body).toContain("face_landmarker.task");
});
