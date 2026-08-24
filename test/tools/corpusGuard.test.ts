import { describe, expect, it } from "vitest";

import { selectClips, type ClipSelection } from "../../tools/corpusGuard.mjs";

// Narrowing helpers, same reason as bundleGuard's: `expect` teaches
// TypeScript nothing, so without them every assertion on a refusal
// reads as a possible success.
function refusal(result: ClipSelection): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a refusal, got clips");
  return result.message;
}

function accepted(result: ClipSelection): string[] {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected clips, got a refusal");
  return result.clips;
}

const DIR = "$DATASETS/eyeblink8/eyeblink8";

// What `readdir(dir, { recursive: true })` really returns: directory
// names appear as entries of their own, files below the top carry
// their subpath. These shapes are the 24 August 2026 incident's cast.

// The folder after the documented preparation: flat .mp4 at the top,
// the raw halves still nested where the evaluator reads them.
const PREPARED = [
  "1",
  "8",
  "26122013_223310_cam.mp4",
  "27122013_151644_cam.mp4",
  "1/26122013_223310_cam.avi",
  "1/26122013_223310_cam.tag",
  "1/26122013_223310_cam.txt",
  "8/27122013_151644_cam.avi",
  "8/27122013_151644_cam.tag",
];

// The raw public download, exactly what printed "0 clips to measure".
const RAW_DOWNLOAD = PREPARED.filter((name) => !name.endsWith(".mp4"));

describe("selectClips, the folder holds a measurable corpus", () => {
  it("finds the flat clips, sorted, and only them", () => {
    expect(accepted(selectClips({ clipsDir: DIR, entries: PREPARED }))).toEqual(
      ["26122013_223310_cam.mp4", "27122013_151644_cam.mp4"],
    );
  });

  it("accepts the canonical prepared layout, raw files and all", () => {
    // The prepared folder deliberately keeps the nested .avi and .tag
    // halves beside the flat clips — the evaluator reads them. Their
    // presence must never turn a good folder into a refusal.
    expect(selectClips({ clipsDir: DIR, entries: PREPARED }).ok).toBe(true);
  });
});

describe("selectClips, the refusals", () => {
  it("refuses the raw public download and names the missing step", () => {
    const message = refusal(
      selectClips({ clipsDir: DIR, entries: RAW_DOWNLOAD }),
    );
    // What it looked for, where, what it found, and the remedy: a
    // count of the .avi files proves the runner SAW the recordings it
    // was refusing, which is the difference between "wrong folder"
    // and "right folder, missing step".
    expect(message).toContain(DIR);
    expect(message).toContain("top level");
    expect(message).toContain("2 .avi files");
    expect(message).toContain("docs/eyeblink8-preparation.txt");
  });

  it("refuses converted clips stranded in subfolders", () => {
    // The likeliest near-miss: running ffmpeg with its output beside
    // its input writes <subject>/<clip>.mp4, converted but nested.
    const strandedBesideRaw = [
      ...RAW_DOWNLOAD,
      "1/26122013_223310_cam.mp4",
      "8/27122013_151644_cam.mp4",
    ];
    const message = refusal(
      selectClips({ clipsDir: DIR, entries: strandedBesideRaw }),
    );
    expect(message).toContain("2 .mp4 files");
    expect(message).toContain("below it");
    expect(message).toContain("docs/eyeblink8-preparation.txt");
    // This is the "so close" case, and blaming the missing conversion
    // would send the reader to redo a step they already did.
    expect(message).not.toContain(".avi");
  });

  it("refuses a folder with no video files at all, asking the real question", () => {
    const message = refusal(
      selectClips({
        clipsDir: DIR,
        entries: ["notes.txt", "sub", "sub/a.csv"],
      }),
    );
    expect(message).toContain(DIR);
    expect(message).toContain("right folder");
    expect(message).toContain("docs/eyeblink8-preparation.txt");
  });

  it("speaks singular for a single found file", () => {
    const message = refusal(
      selectClips({ clipsDir: DIR, entries: ["1", "1/clip.avi"] }),
    );
    expect(message).toContain("1 .avi file ");
  });
});
