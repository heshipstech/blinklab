import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.0d (audit A26). A camera that stops delivering used to
// leave the page "running" on its last photograph: the animation loop
// kept ticking, the model kept reading the same frame, a row a second
// went on describing an eye nobody was looking at, and the delivery
// line blamed the browser ("does not report it"). The session now ends
// by name once a whole delivery window passes with no frame, and the
// record it left is kept.

test("a camera that stops delivering ends the session by name and keeps the record", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Keep a handle to the stream the page requests. The video element
  // never joins the document, so the track is reachable only here.
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    const real = devices.getUserMedia.bind(devices);
    const streams: MediaStream[] = [];
    (window as unknown as { __streams: MediaStream[] }).__streams = streams;
    devices.getUserMedia = async (constraints) => {
      const stream = await real(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Delivery is observed and something was recorded, or "stopped" and
  // "kept" would both be vacuous.
  await expect(page.getByTestId("export-csv")).toBeEnabled({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/Camera delivery: \d+ frames per second/),
  ).toBeVisible({ timeout: 30_000 });

  // Freeze the camera under the page. stop() fires no "ended" event on
  // the track it stops, so only the silence itself can be seen.
  await page.evaluate(() => {
    const streams = (window as unknown as { __streams: MediaStream[] })
      .__streams;
    for (const stream of streams) {
      for (const track of stream.getVideoTracks()) track.stop();
    }
  });

  // One delivery window later the session has ended by name.
  const status = page.locator('p[data-state="cameraStopped"]');
  await expect(status).toBeVisible({ timeout: 15_000 });
  await expect(status).toContainText("no frames in the last 5 s");
  await expect(status).toContainText("kept");

  // The after question, as at any end. A Skip is an answer.
  await page.getByRole("button", { name: "Skip" }).click();

  // The record is on offer, and so is the way back.
  await expect(page.getByTestId("export-csv")).toBeEnabled();
  await expect(page.getByTestId("show-report")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Start camera" }),
  ).toBeVisible();
  await expect(page.getByTestId("mark-moment")).toBeDisabled();
});
