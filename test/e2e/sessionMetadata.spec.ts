import { expect, test } from "@playwright/test";

// The unit tests own the sentences. This owns the thing only a real
// browser can answer: that `getSettings()` on a live track actually
// fills those rows in, and that a marker clicked during a session
// reaches the file.
//
// Reading the track too early returns an empty object and every field
// prints "unknown", which would look exactly like a working feature
// until six people's exports arrived useless.

test("a camera export carries the conditions it was measured under", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();

  // Records arrive about once a second. The export button is the gate.
  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled({ timeout: 30_000 });

  // Mark a moment, which is the ground truth anchor a validation
  // protocol needs: "ten blinks between marker 1 and marker 2" survives
  // even when the instrument detected none of them.
  const mark = page.getByTestId("mark-moment");
  await expect(mark).toBeEnabled();
  await mark.click();

  const download = page.waitForEvent("download");
  await exportCsv.click();
  // The sleepiness question appears on the first export and must be
  // answered or skipped before the file is written.
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible()) {
    await skip.click();
  }
  const stream = await (await download).createReadStream();
  const csv = await new Promise<string>((resolve, reject) => {
    let text = "";
    stream.on("data", (chunk: unknown) => (text += String(chunk)));
    stream.on("end", () => resolve(text));
    stream.on("error", reject);
  });

  // The device block exists and was read from a live track rather than
  // an empty one. The fake camera still negotiates a real size.
  expect(csv).toContain("# camera_resolution: ");
  expect(csv).not.toContain("# camera_resolution: unknown");
  expect(csv).toContain("# camera_declared_fps: ");
  expect(csv).toContain("# user_agent: ");
  expect(csv).toContain("# viewport: ");

  // A stable per-camera identifier is a fingerprint, not a measurement.
  expect(csv).not.toContain("deviceId");

  // The session block, which a camera run never had: it used to say
  // duration and rate were both "unknown" because they came from a
  // clip's duration and there was no clip.
  expect(csv).toContain("# records: ");
  expect(csv).toContain("# face_detected_fraction: ");
  expect(csv).toContain("# visibility_changes: 0");

  // And the marker reached the file.
  expect(csv).toContain("# markers: 1");
  expect(csv).toContain("# marker_1_seconds: ");
});

test("a clip export says plainly that there was no camera", async ({
  page,
}) => {
  // The other half. A clip run has no track to read, and the block must
  // say so rather than vanish, or a reader cannot tell a dropped field
  // from one nobody thought of.
  await page.goto("./");
  await page
    .getByTestId("clip-input")
    .setInputFiles("test/fixtures/clip-60fps-60frames.mp4");
  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled({ timeout: 30_000 });

  const download = page.waitForEvent("download");
  await exportCsv.click();
  const stream = await (await download).createReadStream();
  const csv = await new Promise<string>((resolve, reject) => {
    let text = "";
    stream.on("data", (chunk: unknown) => (text += String(chunk)));
    stream.on("end", () => resolve(text));
    stream.on("error", reject);
  });

  expect(csv).toContain("not a camera session");
});
