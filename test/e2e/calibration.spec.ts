import { expect, test } from "@playwright/test";

// The first end to end test: the calibration flow, driven through the
// real built app in a headless browser with a fake camera. The fake
// stream has no face, so samples can never collect. What this proves
// is the WIRING: camera starts, the overlay opens on the first target,
// one click cancels, and a cancelled run stores nothing. The capture
// and solver math stay covered by their unit tests.
test("the calibration flow opens on dot 1 of 9 and cancels cleanly", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "blinklab" })).toBeVisible();

  // The fake permission flag grants this without any prompt.
  await page.getByRole("button", { name: "Start camera" }).click();

  // Camera running: the calibrate button joins the page.
  const calibrate = page.getByRole("button", { name: "Calibrate gaze" });
  await expect(calibrate).toBeVisible();

  // Opening the overlay needs the landmarker loaded and one frame
  // loop tick, so the model and WASM download from our own preview
  // server first. Generous timeout: CI machines are slow.
  await calibrate.click();
  await expect(
    page.getByText("Follow the dot (1/9). Click anywhere to cancel."),
  ).toBeVisible({ timeout: 30_000 });

  // The dot sits on the first of the nine known targets.
  const dot = page.getByTestId("calibration-dot");
  await expect(dot).toBeVisible();
  expect(await dot.evaluate((el) => el.style.left)).toBe("10%");
  expect(await dot.evaluate((el) => el.style.top)).toBe("10%");

  // One click anywhere cancels, as 5.4a promised.
  await page.getByTestId("calibration-overlay").click();
  await expect(page.getByText("Follow the dot", { exact: false })).toBeHidden();

  // A cancelled run must leave no trace: the button still offers a
  // first calibration, and no profile reached local storage.
  await expect(calibrate).toBeVisible();
  const storedProfile = await page.evaluate(() =>
    localStorage.getItem("blinklab-calibration-profile-v1"),
  );
  expect(storedProfile).toBeNull();
});

test("the demo notice is visible on load and cannot be dismissed", async ({
  page,
}) => {
  // The ladder's check for 6.9. It must be there BEFORE any camera
  // permission, so a visitor who never starts the camera still sees
  // it, and no interaction may remove it.
  await page.goto("/blinklab/");
  const notice = page.getByTestId("demo-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("not a safety or medical device");
  await expect(notice).toContainText("no data leaves your device");
  // Click it, click the page, and confirm it survives.
  await notice.click();
  await page.locator("body").click();
  await expect(notice).toBeVisible();
});

test("every element lives in a zone, nothing is appended to the page root", async ({
  page,
}) => {
  // The guard against this layout decaying back into a flat list.
  // The page was a fossil record of the build order because every
  // increment appended one more line to the root; this fails CI the
  // moment something is appended outside a zone again.
  await page.goto("/blinklab/");
  const orphans = await page.evaluate(() => {
    const app = document.querySelector("#app");
    if (app === null) {
      return ["#app is missing"];
    }
    return [...app.children]
      .filter((child) => !(child as HTMLElement).dataset.zone)
      .map((child) => `${child.tagName}#${child.id} .${child.className}`);
  });
  expect(orphans).toEqual([]);

  const zones = await page.evaluate(() =>
    [...(document.querySelector("#app")?.children ?? [])].map(
      (child) => (child as HTMLElement).dataset.zone,
    ),
  );
  expect(zones).toEqual([
    "notice",
    "measured",
    "peripheral",
    "between",
    "overlay",
  ]);
});

test("the page fits one screen with no vertical scrolling", async ({
  page,
}) => {
  // Scrolling hides the video preview, which is how a person checks
  // the model is tracking their face at all.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/blinklab/");
  const overflows = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(overflows).toBe(false);
});
