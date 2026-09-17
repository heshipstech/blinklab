import { expect, test } from "@playwright/test";

import { demoTimelineStory } from "../../src/core/timelineDemo";
import {
  timelineScoreSegments,
  timelineTickXs,
} from "../../src/core/timelineStrip";

// Roadmap 14.1's second Check clause, verbatim: e2e via synthetic
// injected events, never a face video. The page's ?timelineDemo=1
// hook paints the committed story once and confesses the shortcut
// out loud; this spec recomputes every drawn count from the same
// pure modules the page used and demands the canvas agree — no
// expected numbers copied in to rot. The counts are width-invariant
// (a tick either lands in the span or is dropped), so the arbitrary
// width below cannot disagree with the page's own.

test("the demo hook draws the synthetic story and says so", async ({
  page,
}) => {
  await page.goto("./?timelineDemo=1");
  const strip = page.getByTestId("timeline-strip");
  await expect(strip).toBeVisible();
  await expect(page.getByTestId("timeline-demo-note")).toBeVisible();

  const story = demoTimelineStory();
  const width = 100;
  const segments = timelineScoreSegments(
    story.scoreSamples,
    story.span,
    width,
    40,
  );
  await expect(strip).toHaveAttribute(
    "data-blink-ticks",
    String(timelineTickXs(story.blinkTimesMs, story.span, width).length),
  );
  await expect(strip).toHaveAttribute(
    "data-closure-ticks",
    String(timelineTickXs(story.closureTimesMs, story.span, width).length),
  );
  await expect(strip).toHaveAttribute(
    "data-alert-ticks",
    String(timelineTickXs(story.alertTimesMs, story.span, width).length),
  );
  await expect(strip).toHaveAttribute(
    "data-score-points",
    String(segments.reduce((sum, segment) => sum + segment.length, 0)),
  );
  await expect(strip).toHaveAttribute(
    "data-score-segments",
    String(segments.length),
  );
});

test("without the flag the strip stays hidden and confesses nothing", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Alertness demo" }),
  ).toBeVisible();
  await expect(page.getByTestId("timeline-strip")).toBeHidden();
  await expect(page.getByTestId("timeline-demo-note")).toBeHidden();
});
