import { expect, test } from "@playwright/test";

// Increment 7.0: a recorded clip runs through the same pipeline as the
// live camera.
//
// The clip is generated inside the browser rather than committed as a
// fixture. Two reasons. A binary in the repo is a thing nobody can
// review, and this machine has no ffmpeg to make one with. Recording a
// canvas through MediaRecorder gives a real WebM the browser can
// certainly decode, because the same browser just encoded it.
//
// What this proves is the WIRING, in the same spirit as the calibration
// test. A synthetic clip has no face in it, so no measurement can be
// asserted. What can be asserted is that the file is accepted, decoded,
// reported by name and size, and that the app enters the running state
// on a source that is not a camera at all.

const CLIP_WIDTH = 320;
const CLIP_HEIGHT = 240;

// A committed fixture rather than a clip built in the browser. The
// previous version recorded a canvas through MediaRecorder, which works
// on a developer's Mac and does not exist at all in WebKit on Linux, so
// the cross-browser tests could never run in continuous integration.
// See test/fixtures/README.md for how it is generated and why 60 frames
// per second is the point.
const FIXTURE = "test/fixtures/clip-60fps-60frames.mp4";
const FIXTURE_FRAMES = 60;

test("a recorded clip loads and runs through the same pipeline @chromium-only", async ({
  page,
}) => {
  // Generating the clip takes two seconds, and the landmarker fetches
  // about fifteen megabytes before playback may start.
  test.setTimeout(180_000);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "blinklab" })).toBeVisible();

  // The upload control is offered without starting a camera at all,
  // which is the point: a dataset clip must be measurable on a machine
  // that has no camera.
  const input = page.getByTestId("clip-input");
  await expect(input).toBeAttached();

  // This test covers the WATCHED path, so the step toggle comes off.
  // Stepping has its own test below.
  await page.getByTestId("step-toggle").uncheck();

  await page.getByTestId("clip-input").setInputFiles(FIXTURE);

  // The clip is decoded and described by name and true dimensions.
  // Reaching this line means loadVideoFile resolved on loadedmetadata,
  // so the browser really parsed the container.
  await expect(
    page.getByText(
      `Clip: clip-60fps-60frames.mp4, ${String(CLIP_WIDTH)} x ${String(CLIP_HEIGHT)} pixels`,
      { exact: false },
    ),
  ).toBeVisible({ timeout: 30_000 });

  // Running state, reached without ever touching getUserMedia.
  await expect(
    page.getByRole("button", { name: "Calibrate gaze" }),
  ).toBeVisible({ timeout: 30_000 });

  // The load bearing assertion, and the one that replaced a weak
  // predecessor. The old test only checked that the frame rate label
  // had stopped saying "measuring...", which the display loop
  // satisfies on its own before a clip is ever picked, so deleting the
  // line that makes clip playback work still left the suite green.
  //
  // The inference readout is written ONLY inside processFrame, and in
  // file mode processFrame is reachable only from the per decoded
  // frame callback. A millisecond figure here therefore proves a real
  // frame of this clip reached the model.
  await expect(page.getByText(/Inference time: \d+ ms/)).toBeVisible({
    timeout: 60_000,
  });

  // Playing to the end proves the rest of the chain: the model
  // finished loading, playback started only afterwards, and the clip
  // was consumed rather than abandoned.
  await expect(
    page.getByText("The clip finished", { exact: false }),
  ).toBeVisible({ timeout: 60_000 });

  // Deliberately NOT asserted: that the frame rate readout matches the
  // clip's 10 frames per second. On a CI machine the model runs on the
  // CPU and takes seconds per frame, so a clip playing in real time is
  // measured at whatever rate inference manages, not at its own. That
  // is honest behaviour rather than a bug, since the readout describes
  // frames actually MEASURED and the frame rate gate then refuses a
  // rate too coarse to see a blink. It is also why a batch runner must
  // step a clip frame by frame instead of playing it.
});

test("a file the browser cannot decode fails as a clip, not as a camera", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "blinklab" })).toBeVisible();

  // A text file wearing a video name. The decoder will refuse it.
  await page.evaluate(() => {
    const file = new File([new Blob(["not a video"])], "broken.mp4", {
      type: "video/mp4",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="clip-input"]',
    );
    if (input === null) throw new Error("no clip input on the page");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // The message names the file and suggests a format. It must not send
  // anyone to their camera permissions to fix a broken download.
  const failure = page.getByText("could not decode broken.mp4", {
    exact: false,
  });
  await expect(failure).toBeVisible({ timeout: 30_000 });
  expect(await failure.textContent()).not.toContain("camera");
});

test("stepping measures every frame of a fast clip", async ({ page }) => {
  // THE REGRESSION TEST. The previous version of this test used a 10
  // frames per second clip, and at 100 ms between frames nothing could
  // slip through the old play-and-pause stepper, so it passed while the
  // stepper was measuring barely half of a real recording.
  //
  // The owner's own 60 fps clip is what exposed it: 12,626 frames in
  // the file, 6,655 measured, and the app reported "measured every
  // frame". Worse, the shortfall tracked how busy the machine was,
  // which is the exact dependence stepping exists to remove.
  //
  // So this clip pushes frames as fast as the browser will take them,
  // and the assertion is on the COUNT, not on a rate. Anything that
  // lets a frame slip fails here.
  test.setTimeout(300_000);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "blinklab" })).toBeVisible();

  await expect(page.getByTestId("step-toggle")).toBeChecked();

  await page.getByTestId("clip-input").setInputFiles(FIXTURE);

  const finished = page.getByText("Measured", { exact: false });
  await expect(finished).toBeVisible({ timeout: 240_000 });

  const text = (await finished.textContent()) ?? "";
  const measured = Number(/Measured (\d+)/.exec(text)?.[1] ?? Number.NaN);

  // Within one frame of what was pushed. The old stepper returned
  // roughly half on a clip this fast.
  expect(measured).toBeGreaterThanOrEqual(FIXTURE_FRAMES - 1);
  expect(measured).toBeLessThanOrEqual(FIXTURE_FRAMES + 1);
});
