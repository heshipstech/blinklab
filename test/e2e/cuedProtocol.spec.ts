import { expect, test } from "@playwright/test";

import { CUE_SCHEDULE, scaledCues } from "../../src/core/cueSchedule";
import { answerOpeningQuestion } from "./support/kss";

// Roadmap 11.0b's first Check clause, verbatim: Playwright drives the
// overlay off a SHORTENED schedule and reads the cue rows back from
// the export. The scale rides the page's own query hook, and the
// honesty of the shortcut is the export's business, not this test's:
// the cue_time_scale row below says exactly what ran, so the file
// this spec downloads could never pass as a real session.

const SCALE = 0.02;

test("the cued overlay runs a shortened schedule into the export", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(`./?cueTimeScale=${String(SCALE)}`);
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // The protocol rides the light response's gate: nothing to cue
  // against until a record exists.
  const start = page.getByTestId("cued-protocol");
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();

  const overlay = page.getByTestId("cue-overlay");
  await expect(overlay).toBeVisible();

  // At scale 0.02 the whole schedule is about 2.4 seconds; the done
  // screen then stays up to be read, exactly like the light overlay's.
  await expect(overlay).toHaveAttribute("data-cue", "done", {
    timeout: 30_000,
  });
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();

  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled();
  const download = page.waitForEvent("download");
  await exportCsv.click();
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

  // The rows are the ground truth the analysis scores from, so this
  // spec recomputes them from the same pure module the page used and
  // demands the file agree — no expected strings copied in to rot.
  const instructions = scaledCues(SCALE).cues.filter(
    (cue) => cue.kind !== "rest",
  );
  expect(csv).toContain(`# cues: ${String(instructions.length)}`);
  expect(csv).toContain(`# cue_time_scale: ${SCALE.toFixed(3)}`);
  expect(csv).toMatch(/# cue_protocol_start_ms: [0-9]/);
  instructions.forEach((cue, index) => {
    expect(csv).toContain(`# cue_${String(index + 1)}_kind: ${cue.kind}`);
    expect(csv).toContain(
      `# cue_${String(index + 1)}_seconds: ${(cue.atMs / 1000).toFixed(3)}`,
    );
  });
  // The unscaled count is the same count: the scale moves times, not
  // the schedule's shape.
  expect(instructions.length).toBe(
    CUE_SCHEDULE.filter((cue) => cue.kind !== "rest").length,
  );
});

test("a session without the protocol exports no cue rows", async ({ page }) => {
  // Absence is the record that nothing was asked (the pseudonym
  // rule): a reader must never wonder whether cue rows were dropped.
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);
  const exportCsv = page.getByTestId("export-csv");
  await expect(exportCsv).toBeEnabled({ timeout: 30_000 });
  const download = page.waitForEvent("download");
  await exportCsv.click();
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
  expect(csv).not.toContain("# cue_");
  expect(csv).not.toContain("# cues:");
});
