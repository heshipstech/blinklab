import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Roadmap 10.8a5, the disk half of the replay runner. The join itself
// is `joinMissFacts` in src/core/replayTables.ts — pure string work,
// tested without a filesystem. This is the few lines that reach the
// disk so that function does not have to, the same split
// `writeVerdictFixtures.mjs` keeps and for the same reason: the test
// tsconfig carries no node types, so a `readFileSync` in a `.test.ts`
// is an untyped call the checker refuses.
//
// It is driven by an environment variable rather than an argument
// because the caller is vitest, which owns its own command line:
// `REPLAY_TRACE_DIR=... REPLAY_MISS_TABLE=... REPLAY_OUT=... npm run
// replay:run` sets them and runs the one spec that wires these calls
// to the typed core.

/** Whether this run was asked to perform the join and write the table. */
export function runRequested() {
  return process.env["REPLAY_RUN"] === "1";
}

/** Read a file as UTF-8 text. */
export function readText(path) {
  return readFileSync(path, "utf8");
}

/**
 * Every `<clip>.frames.csv` in a trace directory, as a map from clip
 * stem to file text. A directory missing a clip the miss table names
 * is caught by `joinMissFacts`, which refuses it, rather than here.
 */
export function readTraceDir(traceDir) {
  const suffix = ".frames.csv";
  const map = new Map();
  for (const name of readdirSync(traceDir)) {
    if (name.endsWith(suffix)) {
      map.set(
        name.slice(0, -suffix.length),
        readFileSync(join(traceDir, name), "utf8"),
      );
    }
  }
  return map;
}

/** Write the joined table to disk verbatim, its CRLF included. */
export function writeText(path, text) {
  writeFileSync(path, text, "utf8");
}
