import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// Roadmap 14.0d (audit A5). A camera start superseded while its
// request was still in flight used to attach its stream anyway and
// return, leaving a live track that nothing owned and nothing could
// stop: the recording light stayed on for the page's life. The request
// and the attachment are now two steps with the run token checked
// between them, and the picker and the clip input are disabled while
// a start is in flight.

test("two camera picks inside one request's latency leave exactly one live track", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    // Two cameras, so the picker shows. Both are the one fake device;
    // the ids are stripped before the real request below.
    devices.enumerateDevices = () =>
      Promise.resolve(
        ["fake-a", "fake-b"].map(
          (deviceId, index) =>
            ({
              kind: "videoinput",
              deviceId,
              groupId: "",
              label: `Fake camera ${String(index + 1)}`,
              toJSON: () => ({}),
            }) as MediaDeviceInfo,
        ),
      );
    // Slow, so a second pick lands inside the first request's latency,
    // and remembered, so the test can count what stayed live.
    const real = devices.getUserMedia.bind(devices);
    const streams: MediaStream[] = [];
    (window as unknown as { __streams: MediaStream[] }).__streams = streams;
    devices.getUserMedia = async (constraints) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const video = constraints?.video;
      const stream = await real({
        ...constraints,
        video:
          typeof video === "object" ? { ...video, deviceId: undefined } : video,
      });
      streams.push(stream);
      return stream;
    };
  });
  await page.goto("./");

  // While the first start is in flight, nothing else may start.
  const clipInput = page.getByTestId("clip-input");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(clipInput).toBeDisabled();
  await answerOpeningQuestion(page);

  const picker = page.getByRole("combobox", { name: "Camera" });
  await expect(picker).toBeVisible({ timeout: 30_000 });
  await expect(clipInput).toBeEnabled();

  // Two changes inside one request's latency, dispatched directly so
  // the disabled picker cannot serialise them: the second supersedes
  // the first, whose stream then arrives with nobody to own it.
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Camera"]',
    );
    if (select === null) throw new Error("no picker on the page");
    for (const value of ["fake-b", "fake-a"]) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await expect(picker).toBeDisabled();
  await expect(clipInput).toBeDisabled();
  await expect(picker).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId("stop-camera")).toBeVisible();

  // Three streams were requested; one is live.
  const counts = await page.evaluate(() => {
    const streams = (window as unknown as { __streams: MediaStream[] })
      .__streams;
    return {
      requested: streams.length,
      live: streams
        .flatMap((stream) => stream.getTracks())
        .filter((track) => track.readyState === "live").length,
    };
  });
  expect(counts.requested).toBe(3);
  expect(counts.live).toBe(1);
});
