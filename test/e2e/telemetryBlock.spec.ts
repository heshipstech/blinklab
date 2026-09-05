import { expect, test } from "@playwright/test";

import { answerOpeningQuestion } from "./support/kss";

// ADR-0004, the block. The vendored MediaPipe bundle POSTs usage
// statistics to https://odml.pa.googleapis.com/v1/log about a minute
// after the face model is created, needing no detections. main.ts
// installs installTelemetryBlock() before anything else runs, in front
// of fetch, XMLHttpRequest and sendBeacon.
//
// A blocked request is dropped inside the page, so the browser's network
// stack never sees it and page.on("request") never fires for it. That is
// exactly the property these tests assert: a leak would show up here as
// a captured request to a googleapis.com host.
//
// Two proofs, because each covers what the other cannot:
//
//   1. Deterministic. From inside the page, call all three transports at
//      the exact endpoint and confirm none reached the network and fetch
//      got its synthetic 204. This runs in milliseconds and cannot be
//      trivially green: if the block were absent, the requests would go
//      out and be caught.
//
//   2. Live. Start the camera, let the real bundle build its graph, wait
//      past the sixty-second mark it fires at, and confirm nothing left.
//      A shorter wait would be meaningless per the ADR. This one is
//      guarded by first proving the model actually ran (a frame was
//      measured), so a run where the model never loaded fails loudly
//      rather than passing on an empty window.

/** A host that is or sits under googleapis.com — the thing we must not reach. */
function isGoogleApisHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "googleapis.com" || host.endsWith(".googleapis.com");
  } catch {
    return false;
  }
}

const TELEMETRY_URL = "https://odml.pa.googleapis.com/v1/log";

test("the telemetry endpoint is unreachable from inside the page", async ({
  page,
}) => {
  const leaked: string[] = [];
  page.on("request", (request) => {
    if (isGoogleApisHost(request.url())) {
      leaked.push(request.url());
    }
  });

  await page.goto("./");

  // fetch: the wrapper resolves a synthetic 204 without a network call.
  const fetchStatus = await page.evaluate(async (url) => {
    const response = await fetch(url, { method: "POST", body: "probe" });
    return response.status;
  }, TELEMETRY_URL);
  expect(fetchStatus).toBe(204);

  // sendBeacon: reports queued, queues nothing.
  const beaconQueued = await page.evaluate(
    (url) => navigator.sendBeacon(url, "probe"),
    TELEMETRY_URL,
  );
  expect(beaconQueued).toBe(true);

  // XMLHttpRequest: send() is a no-op for the blocked host.
  await page.evaluate((url) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.send("probe");
  }, TELEMETRY_URL);

  // Give any real network attempt a moment to appear before judging.
  await page.waitForTimeout(500);
  expect(leaked).toEqual([]);
});

test("the running model reports nothing to Google across its telemetry window", async ({
  page,
}) => {
  // The bundle fires ~60s after the model is created; wait comfortably
  // past that, plus build and model-load time.
  test.setTimeout(150_000);

  const leaked: string[] = [];
  page.on("request", (request) => {
    if (isGoogleApisHost(request.url())) {
      leaked.push(request.url());
    }
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Prove the model actually ran before trusting a quiet window: the
  // frame counter only leaves zero once a loaded FaceLandmarker is
  // processing frames, which is also what starts the telemetry timer.
  await expect(page.getByTestId("frames-measured")).toHaveText(/^[1-9]\d*$/, {
    timeout: 90_000,
  });

  // Now sit past the sixty-second report point.
  await page.waitForTimeout(70_000);

  expect(leaked).toEqual([]);
});
