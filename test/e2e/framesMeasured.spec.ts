import { expect, test } from "@playwright/test";

// Remediation B1. `framesMeasured` is written into every exported CSV
// header as `frames_measured`, and it used to tick at display rate
// from the moment a camera session began, while the model was still
// seconds away from existing. A cold start wrote thousands of phantom
// frames into the header of an otherwise honest file. The counter now
// lives inside the landmarker guard: a frame is measured only when
// the model saw it.
//
// The counter is observable through a hidden probe element written on
// every accepted frame, OUTSIDE the guard, so moving the increment
// back out of the guard cannot drag the probe with it. The no-model
// test STALLS the model download rather than failing it, because a
// failed download has had its own state and message since B2, while
// a download in flight is exactly the cold start this counter lied
// about.
//
// Two tests, and the pair is the point. The first proves the counter
// stays at zero without a model. Alone it could pass vacuously, so
// the probe starts EMPTY and only a real frame writes "0": a dead
// wire fails the assertion. The second proves the same probe climbs
// when the model exists. The stepped-clip test in videoFile.spec.ts
// squeezes from the other side: a 60 frame clip must report 60
// measured, within the one frame of slack that test allows, so the
// guard cannot be narrowed into undercounting by more than that.
// What a clip run says when the model is MISSING lives in
// modelFailed.spec.ts: since remediation B2 that case is refused by
// name before the first seek, so B1's deeper zero-measured refusal
// in the summary is defense in depth that no staged test can reach.

test("no frame counts as measured before the model exists", async ({
  page,
}) => {
  // The routes STALL rather than abort, and the difference is the
  // scenario. An aborted download is a failure, and since remediation
  // B2 a failure ends the session with its own state and message. A
  // download that hangs is the cold start B1 is about: the session
  // runs, frames flow, and the model simply is not there yet. The
  // handlers never resolve, so the model stays forever in flight.
  // Installed before the page loads, so no cached copy sneaks past.
  await page.route("**/mediapipe-wasm/**", () => {
    // Never resolved: the request hangs for the life of the page.
  });
  await page.route("**/models/**", () => {
    // Never resolved: the request hangs for the life of the page.
  });

  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness measurement demo" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start camera" }).click();

  // Frames are flowing: the fake camera is up and the loop has ticked
  // often enough to compute a rate. Without this, a zero counter
  // could mean a stalled loop rather than a working guard.
  await expect(
    page.locator("p").filter({ hasText: /Processing rate: \d+/ }),
  ).toBeVisible({ timeout: 30_000 });

  const probe = page.getByTestId("frames-measured");
  await expect(probe).toHaveText("0");

  // A fixed wait, on purpose. The claim is that nothing advances
  // WHILE frames keep flowing, and absence of change over time cannot
  // be proven by a poll that stops at the first success. At sixty
  // frames a second this is another forty-odd ticks, every one of
  // which the old code would have counted.
  await page.waitForTimeout(750);
  await expect(probe).toHaveText("0");
});

test("the counter climbs once the model exists", async ({ page }) => {
  // The other half of the pair: the same probe, no block, and the
  // count must leave zero. This is what makes the first test's zero
  // meaningful, and it fails if the counter is ever narrowed into
  // requiring a detected face, which the fake camera never provides.
  test.setTimeout(120_000);
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness measurement demo" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start camera" }).click();

  // Attached first, positively. A negated matcher on a mistyped test
  // id would pass on the missing element, and this file exists to
  // refuse exactly that kind of vacuous green.
  const probe = page.getByTestId("frames-measured");
  await expect(probe).toBeAttached();

  // Generous timeout: the model and WASM download from the preview
  // server first, and CI machines are slow.
  await expect(probe).toHaveText(/^[1-9]\d*$/, { timeout: 90_000 });
});
