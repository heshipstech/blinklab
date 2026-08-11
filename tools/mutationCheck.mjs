// The mutation list for the safety-relevant constants, runnable.
// Remediation C1. The audit found the 30 second learning window could
// be cut to 1 second with every test green, and the pose limits could
// be bent to 89 degrees or 1 degree unnoticed, because the tests
// derived their inputs FROM the constants and moved with them.
//
// This script is the check that stays checkable: for each mutation it
// bends the constant, runs the unit suite, DEMANDS at least one red
// test, and restores the file. A mutation that survives is the
// finding. Run it from the repo root:
//
//     node tools/mutationCheck.mjs
//
// It is a local gate, not a CI step: it runs the whole suite once per
// mutation, about a minute in total, and it rewrites source files
// while it works. Run it on a clean tree.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MUTATIONS = [
  // Each entry: the file, the exact source text, the bent version,
  // and which direction of drift it guards against.
  [
    "src/core/constants.ts",
    "BLINK_REFRACTORY_MS = 150",
    "BLINK_REFRACTORY_MS = 1",
    "refractory collapsed: chatter would count as blinks",
  ],
  [
    "src/core/constants.ts",
    "BLINK_REFRACTORY_MS = 150",
    "BLINK_REFRACTORY_MS = 10000",
    "refractory bloated: real blinks would be swallowed",
  ],
  [
    "src/core/constants.ts",
    "maxPitchDeg: 20",
    "maxPitchDeg: 89",
    "pose gate opened: foreshortened faces would measure",
  ],
  [
    "src/core/constants.ts",
    "maxPitchDeg: 20",
    "maxPitchDeg: 1",
    "pose gate slammed: every real face would be refused",
  ],
  [
    "src/core/constants.ts",
    "maxRollDeg: 25",
    "maxRollDeg: 89",
    "pose gate opened on roll",
  ],
  [
    "src/core/constants.ts",
    "maxRollDeg: 25",
    "maxRollDeg: 1",
    "pose gate slammed on roll",
  ],
  [
    "src/core/constants.ts",
    "maxYawDeg: 25",
    "maxYawDeg: 89",
    "pose gate opened on yaw",
  ],
  [
    "src/core/constants.ts",
    "maxYawDeg: 25",
    "maxYawDeg: 1",
    "pose gate slammed on yaw",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_LEARN_MS = 30000",
    "BASELINE_LEARN_MS = 1000",
    "learning window cut: the instrument would claim to know a face after one second",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_LEARN_MS = 30000",
    "BASELINE_LEARN_MS = 600000",
    "learning window bloated: no session would ever finish learning",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_MIN_SAMPLES = 100",
    "BASELINE_MIN_SAMPLES = 1",
    "sample floor removed: one frame could set a baseline",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_MIN_SAMPLES = 100",
    "BASELINE_MIN_SAMPLES = 10000",
    "sample floor bloated",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_RISE_MIN_SAMPLES = 300",
    "BASELINE_RISE_MIN_SAMPLES = 1",
    "ratchet rise floor removed",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_WINDOW_MS = 60000",
    "PERCLOS_WINDOW_MS = 5000",
    "PERCLOS window cut",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_WINDOW_MS = 60000",
    "PERCLOS_WINDOW_MS = 600000",
    "PERCLOS window bloated",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_MIN_OBSERVED_MS = 15000",
    "PERCLOS_MIN_OBSERVED_MS = 1",
    "PERCLOS valid-span rule removed: it would answer from one frame",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_MIN_OBSERVED_MS = 15000",
    "PERCLOS_MIN_OBSERVED_MS = 60000",
    "PERCLOS valid-span bloated",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_STALE_MS = 2000",
    "PERCLOS_STALE_MS = 2000000",
    "staleness rule disabled: a frozen face would keep answering",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_STALE_MS = 2000",
    "PERCLOS_STALE_MS = 1",
    "staleness hair trigger: ordinary frame gaps would blank PERCLOS",
  ],
  [
    "src/core/constants.ts",
    "maxPitchDeg: 20",
    "maxPitchDeg: 19",
    "pose gate tightened by one degree unnoticed",
  ],
  [
    "src/core/constants.ts",
    "maxRollDeg: 25",
    "maxRollDeg: 24",
    "pose gate tightened by one degree on roll",
  ],
  [
    "src/core/constants.ts",
    "maxYawDeg: 25",
    "maxYawDeg: 24",
    "pose gate tightened by one degree on yaw",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_RISE_MIN_SAMPLES = 300",
    "BASELINE_RISE_MIN_SAMPLES = 10000",
    "ratchet rise floor bloated past the recent cap",
  ],
];

// The suite must be green BEFORE anything is bent, and a runner
// that cannot run must be told apart from a suite that went red:
// review demonstrated this script printing "All 18 mutations
// caught" with the test runner replaced by a nonexistent command,
// silent success inside the one tool whose job is refusing it.
function runSuite() {
  try {
    execSync("npx vitest run", { stdio: "pipe" });
    return "green";
  } catch (error) {
    // 126 and 127 are the shell saying the command itself could not
    // run. Anything else nonzero is the suite reporting failures.
    if (typeof error.status !== "number") return "broken";
    if (error.status === 126 || error.status === 127) return "broken";
    return error.status === 0 ? "green" : "red";
  }
}
const preflight = runSuite();
if (preflight !== "green") {
  console.error(
    preflight === "red"
      ? "The suite is already red on the unmutated tree. Fix that first. Nothing was checked."
      : "The test runner itself could not run. Nothing was checked.",
  );
  process.exit(3);
}

let survived = 0;
for (const [file, find, replace, why] of MUTATIONS) {
  const original = readFileSync(file, "utf8");
  if (!original.includes(find)) {
    // A renamed or retuned constant makes the list stale. That is a
    // failure of THIS file, not a pass: update the list.
    console.error(`STALE LIST: "${find}" not found in ${file}`);
    process.exit(2);
  }
  writeFileSync(file, original.replace(find, replace));
  let verdict;
  try {
    verdict = runSuite();
  } finally {
    writeFileSync(file, original);
  }
  if (verdict === "broken") {
    console.error(
      "The test runner died mid-check. File restored, nothing proven.",
    );
    process.exit(4);
  }
  if (verdict === "red") {
    console.log(`caught: ${find.padEnd(36)} -> ${why}`);
  } else {
    survived += 1;
    console.error(`SURVIVED: ${find} -> ${replace} (${why})`);
  }
}

if (survived > 0) {
  console.error(
    `\n${String(survived)} mutation(s) survived. Each one is a safety constant nothing pins.`,
  );
  process.exit(1);
}
console.log(`\nAll ${String(MUTATIONS.length)} mutations caught.`);
