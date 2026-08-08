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
    // WebKit joined after a bug that only Safari had: a stepped clip
    // measured zero frames there while Chromium measured every one.
    // A chromium-only suite could never have caught it, and the owner
    // found it by hand. Camera tests stay chromium-only, since WebKit
    // has no fake camera flag, so the clip tests are the ones that run
    // here and clips are exactly where the difference lives.
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: /videoFile\.spec\.ts/,
    },
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
