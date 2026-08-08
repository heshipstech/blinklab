// Run a corpus of clips through the instrument and keep the blink logs.
//
// This drives the REAL built app in a real browser, stepping every
// frame, which is the only honest way to evaluate it: a Python
// reimplementation of the measurement would be evaluating the
// reimplementation.
//
// Usage:
//   npm run build && npm run preview -- --strictPort &
//   node tools/measure_corpus.mjs <clips-dir> <output-dir>
//
// Slow by design. Every frame is sought and measured, so a thirty
// minute corpus takes hours. Progress is printed per clip so a stalled
// run is visible rather than merely quiet.

import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { webkit } from "@playwright/test";

const [, , clipsDir, outDir] = process.argv;
if (!clipsDir || !outDir) {
  console.error("usage: node tools/measure_corpus.mjs <clips-dir> <out-dir>");
  process.exit(1);
}

const URL = "http://localhost:4173/blinklab/";
await mkdir(outDir, { recursive: true });

const clips = (await readdir(clipsDir))
  .filter((f) => f.endsWith(".mp4"))
  .sort();
console.log(`${clips.length} clips to measure\n`);

const browser = await webkit.launch();
let failures = 0;

for (const [i, clip] of clips.entries()) {
  const started = Date.now();
  const label = `[${i + 1}/${clips.length}] ${basename(clip, ".mp4")}`;
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForSelector('[data-testid="clip-input"]');
    await page.setInputFiles(
      '[data-testid="clip-input"]',
      join(clipsDir, clip),
    );

    // No timeout worth setting here: a ten minute clip at 60 fps is
    // 36,000 frames and the run legitimately takes an hour.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("p")].some((p) =>
          (p.textContent ?? "").startsWith("Measured"),
        ),
      null,
      { timeout: 0 },
    );
    const summary = await page.evaluate(
      () =>
        [...document.querySelectorAll("p")]
          .map((p) => p.textContent ?? "")
          .find((t) => t.startsWith("Measured")) ?? "",
    );

    // The blink log is the point. The per-second file is kept too,
    // because a run that produced no blinks still says something and
    // the per-second rows are how you find out why.
    for (const [testId, suffix] of [
      ["export-blinks", "blinks"],
      ["export-csv", "seconds"],
    ]) {
      const button = page.locator(`[data-testid="${testId}"]`);
      if ((await button.count()) === 0 || (await button.isDisabled())) continue;
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        button.click(),
      ]);
      const path = await download.path();
      await writeFile(
        join(outDir, `${basename(clip, ".mp4")}.${suffix}.csv`),
        await readFile(path, "utf8"),
      );
    }
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    console.log(`${label}  ${summary.slice(0, 62)}  [${mins} min]`);
  } catch (error) {
    failures += 1;
    console.log(
      `${label}  FAILED: ${String(error).split("\n")[0].slice(0, 90)}`,
    );
  } finally {
    await context.close();
  }
}

await browser.close();
console.log(`\ndone. ${clips.length - failures} measured, ${failures} failed.`);
