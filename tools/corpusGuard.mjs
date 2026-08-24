// What is there to measure in this folder — and if nothing, why not.
//
// On 24 August 2026 the first reproduction attempt from a fresh copy
// of the public dataset printed "0 clips to measure" and nothing else,
// then launched a browser, measured nothing, and finished with
// "done. 0 measured, 0 failed" — an empty run wearing a success
// shape. The folder held all eight recordings the runner had come
// for, as the nested .avi files the public download ships; the runner
// reads flat .mp4 files and said nothing about wanting them. The
// conversion between the two turned out never to have been committed
// at all. Issue #309; the step itself now lives in
// docs/eyeblink8-preparation.txt.
//
// Same arrangement as bundleGuard: a pure decision over a directory
// listing, no filesystem of its own, so every refusal is testable
// without a corpus on disk. Every refusal names what was looked for,
// what was found instead, and the committed step between the two,
// because zero of the thing a tool exists to consume is never a count
// to report calmly — it is either the wrong folder or a missing step,
// and the listing says which.

const isNested = (name) => name.includes("/") || name.includes("\\");

const count = (n, what) => `${String(n)} ${what} file${n === 1 ? "" : "s"}`;

/**
 * The clips a corpus folder offers, or the refusal saying why none.
 *
 * `entries` is the folder's RECURSIVE listing, because the refusal is
 * built from what sits below the top level — the runner itself still
 * measures only the flat .mp4 files, deliberately: the prepared
 * corpus keeps its raw .avi and .tag halves in subfolders for the
 * evaluator, and descending into them would measure every clip twice.
 */
export function selectClips({ clipsDir, entries }) {
  const clips = entries
    .filter((name) => !isNested(name) && name.endsWith(".mp4"))
    .sort();
  if (clips.length > 0) {
    return { ok: true, clips };
  }

  const looked =
    `No .mp4 files sit directly in ${clipsDir}, and this runner reads\n` +
    `only that top level.\n`;

  // Top level held none, so every .mp4 here is a nested one. Checked
  // before the .avi case: converted clips stranded in subfolders mean
  // the conversion already ran, and blaming a missing conversion
  // would send the reader to redo a step they already did.
  const nestedMp4 = entries.filter((name) => name.endsWith(".mp4")).length;
  if (nestedMp4 > 0) {
    return {
      ok: false,
      message:
        looked +
        `Found ${count(nestedMp4, ".mp4")} in the folders below it. The\n` +
        `prepared corpus is FLAT — the conversion in\n` +
        `docs/eyeblink8-preparation.txt writes each clip directly into\n` +
        `the top folder. Move these up, or re-run it exactly as written.`,
    };
  }

  const rawAvi = entries.filter((name) => name.endsWith(".avi")).length;
  if (rawAvi > 0) {
    return {
      ok: false,
      message:
        looked +
        `Found ${count(rawAvi, ".avi")} in the folders below it — that is\n` +
        `the raw public download. This corpus needs its one-time\n` +
        `documented conversion: docs/eyeblink8-preparation.txt.`,
    };
  }

  return {
    ok: false,
    message:
      looked +
      `Nothing below it ends in .avi or .mp4 either — is this the\n` +
      `right folder? For Eyeblink8 the measurable folder is built by\n` +
      `docs/eyeblink8-preparation.txt.`,
  };
}
