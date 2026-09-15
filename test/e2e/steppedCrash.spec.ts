import { expect, test } from "@playwright/test";

// Roadmap 14.0e's first Check clause: a throw during a STEPPED clip
// keeps the file provenance. measurementFailed.spec.ts proves the
// camera half; this is the branch that once reset `frameSource` to
// "camera" on its way out, so a crashed FILE run exported as a camera
// one — the exact lie the provenance rows exist to prevent. The
// stepped driver has no loop wrapper: a throw inside processFrame
// travels up through stepThroughVideo into beginClip's catch, where
// src/core/steppedCrash.ts decides that measured frames make this a
// measurement crash (session kept, provenance kept) rather than a
// broken file.

const FIXTURE = "test/fixtures/clip-60fps-60frames.mp4";

test("a throw mid-stepped-run keeps the file provenance in its export", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness demo" }),
  ).toBeVisible();
  await expect(page.getByTestId("step-toggle")).toBeChecked();

  // Armed BEFORE the clip loads, throwing on the fifteenth drawn
  // frame rather than the next one. The alternative — wait for
  // progress, then patch — races a 60-frame clip that a fast machine
  // can finish stepping before the patch lands, and a test that only
  // sometimes injects its failure proves nothing on its green runs.
  // Nothing draws before a source starts on this page, so the count
  // begins with the stepped run itself; by call fifteen frames have
  // been measured (so the crash cannot read as a broken file) and
  // dozens remain (so the run cannot have finished).
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    let drawn = 0;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      drawn += 1;
      if (drawn === 15) {
        CanvasRenderingContext2D.prototype.drawImage = original;
        throw new Error("injected stepped failure");
      }
      return (original as unknown as (...a: unknown[]) => void).apply(
        this,
        args,
      );
    } as CanvasRenderingContext2D["drawImage"];
  });

  await page.getByTestId("clip-input").setInputFiles(FIXTURE);

  // The measurement-crash message, not the broken-file one: frames
  // were measured before the throw, so the session and its exports
  // are kept.
  const message = page.getByText(
    "Measurement stopped because of an internal error",
  );
  await expect(message).toBeVisible({ timeout: 240_000 });
  await expect(message).toContainText("injected stepped failure");

  // The provenance rows, off the export a crash this early is
  // guaranteed to have rows in: the per-frame trace gains one row per
  // measured clip frame, while the seconds export needs a full media
  // second this crash deliberately never reaches.
  const exportFrames = page.getByTestId("export-frames");
  await expect(exportFrames).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportFrames.click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const csv = await new Promise<string>((resolve, reject) => {
    let out = "";
    stream.on("data", (chunk: unknown) => (out += String(chunk)));
    stream.on("end", () => resolve(out));
    stream.on("error", reject);
  });
  expect(csv).toContain("# source: file");
  expect(csv).toContain("# clip: clip-60fps-60frames.mp4");
});
