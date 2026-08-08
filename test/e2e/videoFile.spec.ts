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

async function uploadGeneratedClip(
  page: import("@playwright/test").Page,
  fileName: string,
): Promise<void> {
  await page.evaluate(
    async ([name, width, height]) => {
      const canvas = document.createElement("canvas");
      canvas.width = width as number;
      canvas.height = height as number;
      const maybeContext = canvas.getContext("2d");
      if (maybeContext === null) throw new Error("no 2d context");
      // Re-bound after the guard so the narrowing survives into the
      // draw closure below, which TypeScript will not do for a
      // hoisted function declaration.
      const context = maybeContext;

      // captureStream(0) emits nothing on its own, so each frame is
      // pushed by hand at a known interval. That makes the clip a
      // genuine 10 frames per second, which matters: 10 is far below
      // any display refresh rate, so a frame rate readout near 10 can
      // only have come from the clip's own decoded frames.
      const stream = canvas.captureStream(0);
      const [track] = stream.getVideoTracks() as [
        CanvasCaptureMediaStreamTrack,
      ];
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.addEventListener("dataavailable", (event) => {
        chunks.push(event.data);
      });
      recorder.start();

      for (let frame = 0; frame < 20; frame += 1) {
        context.fillStyle = frame % 2 === 0 ? "#202020" : "#d0d0d0";
        context.fillRect(0, 0, width as number, height as number);
        track.requestFrame();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => {
          resolve();
        });
        recorder.stop();
      });

      const file = new File([new Blob(chunks, { type: "video/webm" })], name, {
        type: "video/webm",
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="clip-input"]',
      );
      if (input === null) throw new Error("no clip input on the page");
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [fileName, CLIP_WIDTH, CLIP_HEIGHT] as const,
  );
}

test("a recorded clip loads and runs through the same pipeline", async ({
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

  await uploadGeneratedClip(page, "sample-clip.webm");

  // The clip is decoded and described by name and true dimensions.
  // Reaching this line means loadVideoFile resolved on loadedmetadata,
  // so the browser really parsed the container.
  await expect(
    page.getByText(
      `Clip: sample-clip.webm, ${String(CLIP_WIDTH)} x ${String(CLIP_HEIGHT)} pixels`,
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
