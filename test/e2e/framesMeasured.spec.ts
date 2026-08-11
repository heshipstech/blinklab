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
// back out of the guard cannot drag the probe with it.
//
// Three tests. The first proves the counter stays at zero without a
// model. Alone it could pass vacuously, so the probe starts EMPTY and
// only a real frame writes "0": a dead wire fails the assertion. The
// second proves the same probe climbs when the model exists. The
// stepped-clip test in videoFile.spec.ts squeezes from the other
// side: a 60 frame clip must report 60 measured, within the one
// frame of slack that test allows, so the guard cannot be narrowed
// into undercounting by more than that. The third pins what a
// stepped clip says when nothing was measured: a refusal, not the
// false diagnosis review caught the first version of this fix
// printing ("stepped at the wrong interval, frames visited twice,
// the exported file is correct", all of it wrong, beside a disabled
// export button).

test("no frame counts as measured before the model exists", async ({
  page,
}) => {
  // The block goes up before the page loads, so no cached model can
  // sneak past it. Both the WASM runtime and the model file are
  // refused: either one alone might leave a half-initialised path.
  await page.route("**/mediapipe-wasm/**", (route) => route.abort());
  await page.route("**/models/**", (route) => route.abort());

  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness measurement demo" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start camera" }).click();

  // Frames are flowing: the fake camera is up and the loop has ticked
  // often enough to compute a rate. Without this, a zero counter
  // could mean a stalled loop rather than a working guard.
  await expect(
    page.locator("p").filter({ hasText: /Frames per second: \d+/ }),
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

test("a stepped clip with no model refuses instead of misdiagnosing", async ({
  page,
}) => {
  await page.route("**/mediapipe-wasm/**", (route) => route.abort());
  await page.route("**/models/**", (route) => route.abort());

  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness measurement demo" }),
  ).toBeVisible();

  // Stepping is the default, asserted rather than assumed.
  await expect(page.getByTestId("step-toggle")).toBeChecked();
  await page
    .getByTestId("clip-input")
    .setInputFiles("test/fixtures/clip-60fps-60frames.mp4");

  // The refusal names the facts: frames were read, none measured.
  const status = page.locator('p[data-state="clipFailed"]');
  await expect(status).toBeVisible({ timeout: 60_000 });
  await expect(status).toContainText("not one frame was measured");

  // And it must NOT deliver the confident wrong story: no duplicate
  // visit diagnosis, no promise of a correct exported file, and the
  // export buttons stay disabled because there is nothing to export.
  await expect(status).not.toContainText("stepped at the wrong interval");
  await expect(status).not.toContainText("is correct");
  await expect(page.getByTestId("export-csv")).toBeDisabled();
  await expect(page.getByTestId("export-blinks")).toBeDisabled();
});
