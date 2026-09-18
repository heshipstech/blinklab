import { expect, test } from "@playwright/test";

import {
  RECORD_REFUSAL_PREFIX,
  RECORD_WALKTHROUGH_STEPS,
} from "../../src/core/recordWalkthrough";

// Roadmap 14.6: the walkthrough under the owner's refusal-first fork.
// The rendered steps come from the same pure module the unit tests
// pin, and the honesty paragraph carries the refusal prefix the
// pipeline actually speaks — recordYourselfProbe.spec.ts remains the
// proof the pipeline speaks it, so between the two specs no copied
// sentence can rot.

test("the walkthrough renders its steps and quotes the real refusal", async ({
  page,
}) => {
  await page.goto("./");
  const walkthrough = page.getByTestId("record-walkthrough");
  await expect(walkthrough).toBeVisible();
  await walkthrough.getByText("Record yourself").click();
  const steps = walkthrough.locator("ol li");
  await expect(steps).toHaveCount(RECORD_WALKTHROUGH_STEPS.length);
  await expect(steps.first()).toContainText("camera app");
  await expect(walkthrough).toContainText(RECORD_REFUSAL_PREFIX);
  await expect(walkthrough).toContainText("docs/record-yourself-probe.txt");
});
