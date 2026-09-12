import { expect, test } from "@playwright/test";

import {
  capabilityLadder,
  type LadderRung,
} from "../../src/core/capabilityLadder";
import { answerOpeningQuestion } from "./support/kss";

// Roadmap 13.6a's third Check clause: the RENDERED ladder matches the
// CORE verdicts. The report prints, in each rung's own sentence, the
// number it judged; this spec parses that number back out, hands it
// to the same pure module the page used, and demands the same status
// word. A rendering that drifted from core — a stale copy, a second
// implementation, a hand-edited sentence — shows up as the two sides
// disagreeing about a number both can see.

function statusWordOf(rung: LadderRung): string {
  return rung.status === "notApplicable"
    ? "NOT APPLICABLE"
    : rung.status.toUpperCase();
}

test("the rendered capability ladder matches core's verdicts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", { name: "Start camera" }).click();
  await answerOpeningQuestion(page);

  // Something must be recorded before a report exists at all.
  await expect(page.getByTestId("export-csv")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("stop-camera").click();
  await expect(page.getByText("How sleepy do you feel now?")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Skip" }).click();

  await expect(page.getByTestId("show-report")).toBeEnabled();
  await page.getByTestId("show-report").click();
  const report = await page
    .getByTestId("participant-report")
    .innerText({ timeout: 10_000 });

  // The block renders, with exactly the three rungs in ladder order.
  expect(report).toContain("Capability ladder");
  const rungLines = report
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.includes("Delivered rate") ||
        line.includes("Iris ruler") ||
        line.startsWith("UNKNOWN — Light:") ||
        line.includes("— Light:"),
    );
  const [rateLine, irisLine, lightLine] = rungLines;
  expect(rungLines).toHaveLength(3);
  if (
    rateLine === undefined ||
    irisLine === undefined ||
    lightLine === undefined
  ) {
    throw new Error("the length assertion above already failed");
  }

  // Rendered vs core, on the numbers the sentences themselves carry.
  // A sentence with no number claimed "unknown", and core must agree
  // that silence reads unknown.
  const numberIn = (line: string): number | null => {
    const match = line.match(/(\d+\.\d+) (?:frames per second|pixels)/);
    return match === null || match[1] === undefined ? null : Number(match[1]);
  };
  const recomputed = capabilityLadder({
    sampledFps: numberIn(rateLine),
    irisWidthPx: numberIn(irisLine),
  });
  const renderedLines = [rateLine, irisLine, lightLine];
  for (const [at, rung] of recomputed.entries()) {
    const rendered = renderedLines[at] ?? "";
    expect(
      rendered.startsWith(`${statusWordOf(rung)} — `),
      `${rung.rung}: rendered "${rendered}" vs core ${rung.status}`,
    ).toBe(true);
  }
});
