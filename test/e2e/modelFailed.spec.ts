import { expect, test } from "@playwright/test";

// Remediation B2. A failed model download used to be swallowed into
// the console: the camera path ran forever looking healthy, readouts
// saying "measuring..." for a measurement that could never come, and
// the clip path walked every frame for nothing. The failure now has
// a named state, a readable message, and a retry button.
//
// The audit's required check is the first test: block the model
// request, assert a readable message appears. The second test is the
// way back: unblock, retry, and the session must actually resume,
// which ties B2 to B1's counter probe, the strictest available proof
// that measurement restarted. The third is the clip path, refused by
// name BEFORE the first seek, where B1's review measured the
// alternative: a full pointless walk ending in a guess.

const MODEL_MESSAGE = "The measuring model could not be loaded";

test("a camera session with no model says so instead of looking healthy", async ({
  page,
}) => {
  await page.route("**/mediapipe-wasm/**", (route) => route.abort());
  await page.route("**/models/**", (route) => route.abort());

  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();

  // The failure surfaces on its own, no user action required. The
  // message names the model and the way back, and the retry button
  // it promises is really there.
  await expect(page.getByText(MODEL_MESSAGE)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("retry-model")).toBeVisible();

  // The healthy-looking lie is gone with the state: no frame rate
  // readout pretending a session is being measured.
  await expect(page.getByText(/Processing rate: \d+/)).toBeHidden();
});

test("retry after the network recovers resumes a real session", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route("**/mediapipe-wasm/**", (route) => route.abort());
  await page.route("**/models/**", (route) => route.abort());

  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByText(MODEL_MESSAGE)).toBeVisible({
    timeout: 30_000,
  });

  // The network comes back.
  await page.unroute("**/mediapipe-wasm/**");
  await page.unroute("**/models/**");

  await page.getByTestId("retry-model").click();

  // Not merely a vanished message: the counter probe from B1 must
  // leave zero, which only a loaded model processing real frames can
  // make happen. Generous timeout, the model downloads now.
  await expect(page.getByTestId("frames-measured")).toHaveText(/^[1-9]\d*$/, {
    timeout: 90_000,
  });
  await expect(page.getByText(MODEL_MESSAGE)).toBeHidden();
  await expect(page.getByTestId("retry-model")).toBeHidden();
});

test("a clip with no model is refused before the first seek", async ({
  page,
}) => {
  await page.route("**/mediapipe-wasm/**", (route) => route.abort());
  await page.route("**/models/**", (route) => route.abort());

  await page.goto("./");
  await expect(page.getByTestId("step-toggle")).toBeChecked();
  await page
    .getByTestId("clip-input")
    .setInputFiles("test/fixtures/clip-60fps-60frames.mp4");

  // The model message, not a stepping progress line and not the old
  // zero-measured summary: the clip must be refused before any
  // frame is walked.
  await expect(page.getByText(MODEL_MESSAGE)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("retry-model")).toBeVisible();
  await expect(page.getByText("Measuring every frame")).toBeHidden();
  await expect(page.getByText("not one frame was measured")).toBeHidden();
  await expect(page.getByTestId("export-csv")).toBeDisabled();
  await expect(page.getByTestId("export-blinks")).toBeDisabled();

  // And the way back for a clip: retry loads the model, and the page
  // says what to do next in clip terms, not camera terms. A clip run
  // never started, so there is nothing to resume, only to re-pick.
  await page.unroute("**/mediapipe-wasm/**");
  await page.unroute("**/models/**");
  await page.getByTestId("retry-model").click();
  await expect(page.getByText("Pick your clip again")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId("retry-model")).toBeHidden();
});
