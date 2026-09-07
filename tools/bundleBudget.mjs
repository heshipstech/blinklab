import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Roadmap 8.7, the bundle size budget.
//
// The failure this is really written against is not slow creep. It is
// the single commit that accidentally pulls something enormous into
// the bundle: the vendored face model is 3.7 MB and the MediaPipe WASM
// folder is 33 MB, both of them deliberately served as separate files
// from public/ rather than bundled. One stray import turns a 212 KB
// download into a 4 MB one, and nothing in the suite would notice,
// because every test would still pass.
//
// So the ceiling is set with real headroom rather than tight against
// today's number. A budget that fails on ordinary work gets raised
// without being read, and then it is decoration.

/**
 * Bytes. About 10% above the 269.8 KB measured on 7 September 2026,
 * when the line-provenance work crossed the previous line: reporting
 * which line the detector read, the conditions a stored line was
 * measured under, and the eleven metadata rows that carry them all
 * ship in the bundle because the export must be written on-device.
 *
 * Raised by the stated procedure rather than waved through. The
 * number was read, what grew was named, and the bundle was checked
 * for the failure this guard is really written against: none of the
 * simulation modules (poseBias, velocityBias, storageQuantum,
 * apertureNoise) appear in the built chunk, which is why the pose
 * span that module needs is a typed constant held to its simulation
 * by a test rather than an import. The headroom is kept.
 *
 * Previous ceilings: 268 KB, 10% above the 243 KB of 29 August 2026,
 * when the participant report crossed the line; 240 KB, 10% above the
 * 217 KB of 15 August 2026.
 */
export const BUNDLE_BUDGET_BYTES = 297_000;

/** Every built JavaScript chunk, with its size in bytes. */
export function bundleChunks(distAssetsDir) {
  return readdirSync(distAssetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      bytes: statSync(join(distAssetsDir, name)).size,
    }));
}

/**
 * The verdict, as data rather than an exit code, so it is testable
 * without a build on disk.
 *
 * Chunks are SUMMED rather than compared one at a time. A budget that
 * looked only at the largest file would be satisfied by splitting one
 * oversized bundle into two, which changes what the browser downloads
 * not at all.
 */
export function budgetVerdict(chunks, budgetBytes = BUNDLE_BUDGET_BYTES) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const kb = (n) => `${(n / 1000).toFixed(1)} kB`;
  if (chunks.length === 0) {
    return {
      ok: false,
      total,
      why: "no JavaScript chunks found: was the build run?",
    };
  }
  return {
    ok: total <= budgetBytes,
    total,
    why:
      total <= budgetBytes
        ? `${kb(total)} of ${kb(budgetBytes)} budget, across ${chunks.length} chunk(s)`
        : `${kb(total)} exceeds the ${kb(budgetBytes)} budget by ${kb(total - budgetBytes)}. Check for something large that should be served from public/ instead of bundled.`,
  };
}
