import { expect, test } from "@playwright/test";

// Roadmap 14.6's feasibility probe, run against the prediction in
// docs/record-yourself-probe.txt (committed first, the
// stepper-honesty precedent). The probe records FACTS: a MediaRecorder
// webm is made in the browser, handed to the clip input the pipeline
// already trusts, and whatever happens must be NAMED — P2's
// variable-rate refusal sentence, one of the stepper's other named
// refusals, or P3's completed stepped run. The spec passes on either
// named outcome, because the probe's job is to find out which one it
// is; it fails only on unnamed misbehavior, which is the one result
// that would gate everything.

const NAMED_REFUSALS = [
  // variableRateRefusal, the prediction's primary outcome (P2).
  "Could not step this clip: its first frames are not evenly spaced",
  // calibration null without the variableRate shape.
  "Could not work out this clip's frame rate",
  // landingRefusal, the inexact-landings fraction.
  "could not be placed on the clip's own",
  // The stepper sought but nothing decoded.
  "No frames could be read from this clip",
];

test("a recorded webm meets the pipeline and the outcome has a name", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto("./");
  await expect(page.getByTestId("step-toggle")).toBeChecked();

  // The recording, made where a visitor would make it: a canvas
  // stream through MediaRecorder, about two seconds, nominally 30
  // frames per second — nominally, because MediaRecorder stamps
  // frames on the wall clock, which is the whole question. The File
  // is handed to the clip input in-page through a DataTransfer, the
  // same change event a picked file fires, so no byte leaves the
  // browser it was recorded in.
  const recordedBytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no 2d context for the probe canvas");
    }
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        resolve();
      };
    });
    recorder.start();
    let hue = 0;
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        hue = (hue + 7) % 360;
        context.fillStyle = `hsl(${String(hue)}, 70%, 50%)`;
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (performance.now() - startedAt < 2000) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      tick();
    });
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: "video/webm" });
    const file = new File([blob], "recorded.webm", { type: "video/webm" });
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="clip-input"]',
    );
    if (input === null) {
      throw new Error("no clip input on the page");
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return blob.size;
  });
  expect(recordedBytes).toBeGreaterThan(0);

  // P1: the clip readout speaks the duration honestly — a figure, or
  // the deliberate "unknown length" for a container that records
  // none. Either is honest; the probe records which.
  const clipReadout = page.getByText(/recorded\.webm/);
  await expect(clipReadout).toBeVisible({ timeout: 30_000 });
  const readoutText = (await clipReadout.textContent()) ?? "";
  expect(
    /\d+\.\d s\.|unknown length\./.test(readoutText),
    `duration readout must be a figure or "unknown length", got: ${readoutText}`,
  ).toBe(true);

  // P2 or P3: the stepped run ends in a NAMED refusal, or it ends —
  // 14.0a's kept ending, "Measured N frames" under data-state ended.
  const outcome = page
    .locator("p[data-state]")
    .filter({ hasText: /Measured \d+ frames|Could not|could not|No frames/ });
  await expect(outcome.first()).toBeVisible({ timeout: 240_000 });
  const outcomeText = (await outcome.first().textContent()) ?? "";
  const state = await outcome.first().getAttribute("data-state");
  // The probe's whole product is WHICH named outcome occurred, so
  // every run prints it — the docs/record-yourself-probe.txt Outcome
  // section is written from this line, not from a rerun.
  console.log(
    `record-yourself probe outcome: state=${String(state)}; ` +
      `duration readout: ${readoutText}; outcome: ${outcomeText}`,
  );

  if (state === "ended") {
    // P3: the recording measured. Feasibility passes outright.
    expect(outcomeText).toMatch(/Measured \d+ frames/);
  } else {
    // A refusal must be one of the pipeline's own named sentences —
    // an unnamed failure is the one outcome that gates everything.
    const named = NAMED_REFUSALS.some((fragment) =>
      outcomeText.includes(fragment),
    );
    expect(
      named,
      `the refusal must be named, got state=${String(state)}: ${outcomeText}`,
    ).toBe(true);
  }
});
