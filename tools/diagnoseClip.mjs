// Why did this clip refuse?
//
// The stepper's refusal — "could not work out this clip's frame rate"
// — is honest but nearly blind: it says calibration failed, not which
// half of calibration failed. Calibration seeks, and a seek can fail
// in two completely different ways that the message cannot tell apart:
//
//   the seek never finishes      -> `seeked` does not fire in time
//   the seek finishes blind      -> `seeked` fires, but the per-frame
//                                   callback never says where we landed
//
// The first is a decoder or index problem, the second is a frame
// callback problem, and the fixes have nothing in common. On 25 August
// 2026 the whole Eyeblink8 corpus refused on a new machine while a
// sixty second cut of the byte-identical stream measured perfectly,
// and a day went into eliminating suspects — pixel format, keyframe
// interval, browser build, harness — that were all innocent because
// nobody could see which half was failing.
//
// This drives the SAME browser the corpus runner drives, against a
// bare video element with no app around it, and reports what actually
// happened. No measurement, no app: just the mechanics.
//
// Usage:
//   node tools/diagnoseClip.mjs <clip.mp4> [seek-attempts]

import { basename } from "node:path";
import { stat } from "node:fs/promises";
import { webkit } from "@playwright/test";

const [, , clipPath, attemptsArg] = process.argv;
if (!clipPath) {
  console.error("usage: node tools/diagnoseClip.mjs <clip.mp4> [attempts]");
  process.exit(1);
}
const ATTEMPTS = Number(attemptsArg ?? "8");

const size = (await stat(clipPath)).size;
console.log(`${basename(clipPath)}  ${(size / 1e6).toFixed(1)} MB\n`);

const browser = await webkit.launch();
const page = await browser.newPage();

// A bare page: an input to receive the real file and a video element.
// Deliberately not the app, so nothing the app does can be blamed.
await page.setContent(
  `<input id="pick" type="file"><video id="v" playsinline muted></video>`,
);
await page.setInputFiles("#pick", clipPath);

const report = await page.evaluate(async (attempts) => {
  const video = document.querySelector("#v");
  const input = document.querySelector("#pick");
  const file = input.files[0];
  const started = performance.now();
  const since = () => Math.round(performance.now() - started);
  const events = [];
  for (const name of [
    "loadedmetadata",
    "loadeddata",
    "canplay",
    "canplaythrough",
    "error",
  ]) {
    video.addEventListener(name, () => {
      events.push(`${name} at ${String(since())} ms`);
    });
  }

  video.preload = "auto";
  video.src = URL.createObjectURL(file);

  const loadOutcome = await new Promise((resolve) => {
    const done = (what) => {
      resolve(`${what} at ${String(since())} ms`);
    };
    video.addEventListener("canplay", () => {
      done("canplay");
    });
    video.addEventListener("error", () => {
      done("ERROR");
    });
    setTimeout(() => {
      done("TIMED OUT after 30 s waiting for canplay");
    }, 30_000);
  });

  const ranges = (list) =>
    Array.from(
      { length: list.length },
      (_, i) => `${list.start(i).toFixed(2)}-${list.end(i).toFixed(2)}`,
    ).join(", ") || "none";

  const facts = {
    loadOutcome,
    events,
    duration: video.duration,
    readyState: video.readyState,
    seekable: ranges(video.seekable),
    buffered: ranges(video.buffered),
    hasFrameCallback: typeof video.requestVideoFrameCallback === "function",
  };

  // Now the part the refusal cannot see: seek, and watch BOTH signals
  // independently. The app prefers the frame callback and falls back
  // to `seeked`; here they are recorded separately so a run that
  // "worked" with no frame callback is visible as such.
  const origin = video.seekable.length > 0 ? video.seekable.start(0) : 0;
  const seeks = [];
  for (let i = 0; i < attempts; i += 1) {
    const target = origin + i * 0.01;
    const at = performance.now();
    const elapsed = () => Math.round(performance.now() - at);
    const result = await new Promise((resolve) => {
      const outcome = { target: Number(target.toFixed(3)) };
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(outcome);
      };
      video.requestVideoFrameCallback((_now, metadata) => {
        outcome.frameCallbackMs = elapsed();
        outcome.mediaTime = Number(metadata.mediaTime.toFixed(4));
        // Give `seeked` its chance too, so both are recorded.
        setTimeout(finish, 300);
      });
      video.addEventListener(
        "seeked",
        () => {
          outcome.seekedMs = elapsed();
          outcome.currentTime = Number(video.currentTime.toFixed(4));
          setTimeout(finish, 300);
        },
        { once: true },
      );
      setTimeout(() => {
        outcome.timedOut = true;
        finish();
      }, 5000);
      video.currentTime = target;
    });
    seeks.push(result);
  }
  return { ...facts, seeks };
}, ATTEMPTS);

console.log(`load: ${report.loadOutcome}`);
for (const line of report.events) console.log(`  ${line}`);
console.log(
  `\nduration ${String(report.duration)} s, readyState ${String(report.readyState)}` +
    `, frame callback ${report.hasFrameCallback ? "present" : "MISSING"}`,
);
console.log(`seekable: ${report.seekable}`);
console.log(`buffered: ${report.buffered}\n`);

for (const [i, s] of report.seeks.entries()) {
  const frame =
    s.frameCallbackMs === undefined
      ? "frame callback NEVER"
      : `frame at ${String(s.frameCallbackMs)} ms (mediaTime ${String(s.mediaTime)})`;
  const seeked =
    s.seekedMs === undefined
      ? "seeked NEVER"
      : `seeked at ${String(s.seekedMs)} ms (currentTime ${String(s.currentTime)})`;
  console.log(
    `seek ${String(i + 1)} -> ${String(s.target)}s: ${frame}; ${seeked}${s.timedOut ? "; TIMED OUT" : ""}`,
  );
}

await browser.close();
