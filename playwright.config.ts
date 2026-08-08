import { defineConfig, devices } from "@playwright/test";

// End to end tests drive the real production build in a real browser.
// CI machines have no camera, so Chromium fakes one: a synthetic test
// stream, permission auto-granted. A fake camera exists, a face does
// not, which is exactly the boundary these tests respect.
export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:4173/blinklab/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
    // WebKit joined after a bug only Safari had: a stepped clip measured
    // zero frames there while Chromium measured every one, and the
    // owner found it by hand because a Chromium-only suite never could.
    //
    // It runs LOCALLY ONLY, and that is a deliberate retreat rather
    // than an oversight. WebKit on a Linux runner is not Safari on a
    // Mac, and trying to keep it green in continuous integration
    // produced three failures in a row that were about the platform,
    // not the code: no MediaRecorder at all, and a stepped clip
    // stopping at 27 frames of 60 for reasons that survived fixing both
    // the calibration and the duration handling. A test that fails for
    // reasons unrelated to the change under review teaches people to
    // ignore red, which is worse than not having it.
    //
    // So: `npm run e2e` on a Mac covers both engines and is where this
    // protection actually lives. Continuous integration covers
    // Chromium. Safari proper is manual check 58, because Playwright's
    // WebKit is not Safari either.
    ...(process.env.CI
      ? []
      : [
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testMatch: /videoFile\.spec\.ts/,
            // The WATCHED path is excluded here, not because it is unimportant
            // but because headless WebKit on a Linux runner cannot play video
            // reliably and the test would fail for reasons that have nothing
            // to do with the code. What WebKit is here to check is SEEKING,
            // which is where the engines genuinely differ and where the
            // zero-frame bug lived.
            grepInvert: /@chromium-only/,
          },
        ]),
  ],
  webServer: {
    // Build first, every time: the test must see the current code,
    // never yesterday's dist folder. strictPort so a busy 4173 fails
    // loudly instead of silently testing some other server.
    command: "npm run build && npm run preview -- --strictPort",
    url: "http://localhost:4173/blinklab/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
