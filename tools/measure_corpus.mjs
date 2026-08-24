// Run a corpus of clips through the instrument and keep the blink logs.
//
// This drives the REAL built app in a real browser, stepping every
// frame, which is the only honest way to evaluate it: a Python
// reimplementation of the measurement would be evaluating the
// reimplementation.
//
// Usage:
//   npm run build
//   npm run preview -- --strictPort &
//   # Check the served bundle before measuring. See below.
//   node tools/measure_corpus.mjs <clips-dir> <output-dir>
//
// The build is on its OWN line on purpose. This note used to read
// `npm run build && npm run preview -- --strictPort &`, where the `&`
// backgrounds the WHOLE chain, build included, so the shell returns
// before anything is built.
//
// This script used to measure WHATEVER answered on port 4173, without
// checking that it was serving the code you built. On 9 August 2026 a
// leftover server from the previous night held the port, so
// `npm run preview -- --strictPort` exited, the old server kept
// answering with HTTP 200, and twenty minutes went into measuring the
// previous build. It returned a plausible number and was believed.
//
// It now refuses instead. Before anything is measured it compares the
// bundle name in dist/assets against the one the served page actually
// references. Vite puts a content hash in that name, so the two names
// agreeing is cheap proof that the code is the same. See
// tools/bundleGuard.mjs and issue #175.
//
// Slow by design. Every frame is sought and measured, so this runs
// slower than the clip plays. Measured on 9 August 2026: about 58
// frames per second, so the eight clip Eyeblink8 corpus of roughly
// 71,000 frames takes about 20 minutes. An earlier comment here said
// "hours", from a much lower estimate that was never re-measured, and
// that figure made a 20 minute rerun look like an overnight job. Time
// it again rather than trusting this line.
//
// Progress is printed per clip so a stalled run is visible rather than
// merely quiet.

import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "@playwright/test";

import { checkBundle } from "./bundleGuard.mjs";
import { selectClips } from "./corpusGuard.mjs";

const [, , clipsDir, outDir] = process.argv;
if (!clipsDir || !outDir) {
  console.error("usage: node tools/measure_corpus.mjs <clips-dir> <out-dir>");
  process.exit(1);
}

const URL = "http://localhost:4173/blinklab/";

// The guard, before anything expensive. A run that measures the wrong
// build costs twenty minutes AND produces a number nobody knows to
// distrust, so this refuses rather than warns.
// fileURLToPath, not URL.pathname. This repository lives under a folder
// whose name contains a space, and pathname returns it percent encoded
// as "blinklab%20build", which readdir cannot find. The guard then
// reported "nothing is built" while dist sat right there, which would
// have been a guard that blocks every honest run and teaches people to
// work around it.
const distDir = fileURLToPath(
  new globalThis.URL("../dist/assets", import.meta.url),
);
let distFileNames;
try {
  distFileNames = await readdir(distDir);
} catch {
  console.error(
    "Cannot read dist/assets. Run `npm run build` before measuring.",
  );
  process.exit(1);
}

let servedHtml;
try {
  const response = await fetch(URL);
  if (!response.ok) {
    console.error(
      `The server on ${URL} answered ${String(response.status)}.\n` +
        "Start it with `npm run preview -- --strictPort &` after building.",
    );
    process.exit(1);
  }
  servedHtml = await response.text();
} catch {
  console.error(
    `Nothing answered on ${URL}.\n` +
      "Start it with `npm run preview -- --strictPort &` after building.",
  );
  process.exit(1);
}

const guard = checkBundle({ distFileNames, html: servedHtml });
if (!guard.ok) {
  console.error(guard.message);
  process.exit(1);
}
console.log(`Serving the build we made: ${guard.bundle}\n`);

// Zero clips is a refusal, not a report. The first run against a
// fresh public download printed "0 clips to measure" and finished
// "done. 0 measured, 0 failed" — an empty run in a success shape,
// with all eight recordings sitting right there as nested .avi files.
// The guard reads the folder recursively so the refusal can say what
// was actually found; the run itself still measures only the flat
// .mp4 files, because the subfolders hold the raw halves the
// evaluator reads. Issue #309.
const selection = selectClips({
  clipsDir,
  entries: await readdir(clipsDir, { recursive: true }),
});
if (!selection.ok) {
  console.error(selection.message);
  process.exit(1);
}
const clips = selection.clips;
console.log(`${clips.length} clips to measure\n`);

await mkdir(outDir, { recursive: true });

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
    // 36,000 frames and the run legitimately takes an hour. The wait
    // also ends on a failed clip, read from the status line's
    // machine-readable state, because this loop used to know only the
    // success words: any clip failure that reaches the clipFailed
    // state would have parked the whole batch forever. (A decode that
    // stalls without ever failing still would; no state exists to
    // see.) And before remediation B1 a clip measured with no model
    // present ended in "Measured 0 frames", which this prefix match
    // booked as a success. "36 measured, 0 failed" with 16 never
    // measured is this project's fourth silent success.
    // Two failure states, matched by name. B2 added modelFailed for
    // a model that never loaded, and a selector that knew only
    // clipFailed would park the batch on it, the exact trap this
    // wait exists to avoid.
    const FAILED_STATES =
      'p[data-state="clipFailed"], p[data-state="modelFailed"]';
    await page.waitForFunction(
      (failedSelector) =>
        document.querySelector(failedSelector) !== null ||
        [...document.querySelectorAll("p")].some((p) =>
          (p.textContent ?? "").startsWith("Measured"),
        ),
      FAILED_STATES,
      { timeout: 0 },
    );
    const failed = await page.evaluate(
      (failedSelector) =>
        document.querySelector(failedSelector)?.textContent?.trim() ?? null,
      FAILED_STATES,
    );
    if (failed !== null) {
      failures += 1;
      console.log(`${label}  FAILED: ${failed.slice(0, 90)}`);
      continue;
    }
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
