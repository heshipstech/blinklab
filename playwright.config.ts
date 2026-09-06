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
      testIgnore: /phone\.spec\.ts/,
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
    // Roadmap 14.0b: the phone. A 375-wide viewport with the same fake
    // camera, running only the specs written for it, because the desktop
    // specs assert desktop geometry and would double the run for no new
    // fact.
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
      testMatch: /phone\.spec\.ts/,
    },
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
    // never yesterday's dist folder.
    //
    // `reuseExistingServer` is false everywhere, CI and laptop alike,
    // so this command always runs and `--strictPort` makes a busy 4173
    // fail loudly.
    //
    // It used to be true on a laptop, and that is issue #175: if any
    // server already answered on 4173, Playwright skipped this command
    // completely. No build ran, `--strictPort` never got its chance,
    // and the suite quietly tested whatever that other server served.
    // It happened on 9 August 2026 — the suite passed against a bundle
    // several hours old.
    //
    // Closed 2026-08-14 by making local behave the way CI already did.
    // The documented workaround was to compare the served bundle name
    // against `dist/assets` by hand before trusting a local pass, and a
    // gate that depends on remembering is not a gate. The cost is a
    // rebuild per run, which `command` was already doing on CI.
    //
    // A sibling repo hit the same trap the same week from the other
    // side: its suite attached to a different project's preview server
    // and 51 of its 84 tests ran against the wrong site.
    command: "npm run build && npm run preview -- --strictPort",
    url: "http://localhost:4173/blinklab/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
