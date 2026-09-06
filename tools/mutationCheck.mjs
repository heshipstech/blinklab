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

// Each entry names the file, the exact source text, the bent version,
// the drift it guards against, and the ONE test file that must go red.
//
// Roadmap 10.1c, ladder D2. Two things were wrong with this list. It
// still bent BASELINE_RISE_MIN_SAMPLES, removed by 171b5f4, so the
// script exited "STALE LIST" before checking anything and had been
// unrunnable since 20 August while REMEDIATION.md said it was
// runnable. And every entry ran the WHOLE suite, about ninety seconds
// each, which is why this was a local gate nobody ran rather than a CI
// step. Naming the owning test file makes each entry a second or two,
// so the whole list plus its one full-suite preflight takes about two
// minutes.
//
// It is a sharper check as well, and the sharpening found something
// the same hour: narrowing the entries turned 10 of these 27 from
// caught into SURVIVED. Nine were the pose gate, whose owning test
// derived every probe from the limits; the tenth was the refractory,
// whose cases stood 20 ms and 180 ms from a 150 ms boundary. Both now
// carry literals. A mutation caught by an unrelated snapshot three
// folders away is not evidence that a constant is pinned, it is
// evidence that the constant leaks into a fixture.
const MUTATIONS = [
  [
    "src/core/constants.ts",
    "BLINK_REFRACTORY_MS = 150",
    "BLINK_REFRACTORY_MS = 1",
    "refractory collapsed: chatter would count as blinks",
    "test/core/blink.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BLINK_REFRACTORY_MS = 150",
    "BLINK_REFRACTORY_MS = 10000",
    "refractory bloated: real blinks would be swallowed",
    "test/core/blink.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxPitchDeg: 20",
    "maxPitchDeg: 89",
    "pose gate opened: foreshortened faces would measure",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxPitchDeg: 20",
    "maxPitchDeg: 1",
    "pose gate slammed: every real face would be refused",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxRollDeg: 25",
    "maxRollDeg: 89",
    "pose gate opened on roll",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxRollDeg: 25",
    "maxRollDeg: 1",
    "pose gate slammed on roll",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxYawDeg: 25",
    "maxYawDeg: 89",
    "pose gate opened on yaw",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxYawDeg: 25",
    "maxYawDeg: 1",
    "pose gate slammed on yaw",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_LEARN_MS = 30000",
    "BASELINE_LEARN_MS = 1000",
    "learning window cut: the instrument would claim to know a face after one second",
    "test/core/baseline.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_LEARN_MS = 30000",
    "BASELINE_LEARN_MS = 600000",
    "learning window bloated: no session would ever finish learning",
    "test/core/baseline.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_MIN_SAMPLES = 100",
    "BASELINE_MIN_SAMPLES = 1",
    "sample floor removed: one frame could set a baseline",
    "test/core/baseline.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BASELINE_MIN_SAMPLES = 100",
    "BASELINE_MIN_SAMPLES = 10000",
    "sample floor bloated",
    "test/core/baseline.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_WINDOW_MS = 60000",
    "PERCLOS_WINDOW_MS = 5000",
    "PERCLOS window cut",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_WINDOW_MS = 60000",
    "PERCLOS_WINDOW_MS = 600000",
    "PERCLOS window bloated",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_MIN_OBSERVED_MS = 15000",
    "PERCLOS_MIN_OBSERVED_MS = 1",
    "PERCLOS valid-span rule removed: it would answer from one frame",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_MIN_OBSERVED_MS = 15000",
    "PERCLOS_MIN_OBSERVED_MS = 60000",
    "PERCLOS valid-span bloated",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_STALE_MS = 2000",
    "PERCLOS_STALE_MS = 2000000",
    "staleness rule disabled: a frozen face would keep answering",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_STALE_MS = 2000",
    "PERCLOS_STALE_MS = 1",
    "staleness hair trigger: ordinary frame gaps would blank PERCLOS",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxPitchDeg: 20",
    "maxPitchDeg: 19",
    "pose gate tightened by one degree unnoticed",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxRollDeg: 25",
    "maxRollDeg: 24",
    "pose gate tightened by one degree on roll",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "maxYawDeg: 25",
    "maxYawDeg: 24",
    "pose gate tightened by one degree on yaw",
    "test/core/validityGate.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_MIN_SAMPLES = 100",
    "PERCLOS_MIN_SAMPLES = 2",
    "PERCLOS sample floor removed: two frames could publish a share of a minute",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/perclos.ts",
    "PERCLOS_MIN_SAMPLES = 100",
    "PERCLOS_MIN_SAMPLES = 1000",
    "PERCLOS sample floor bloated past what a 25 fps session can produce",
    "test/core/perclos.test.ts",
  ],
  [
    "src/core/constants.ts",
    "MIN_BLINK_FPS = 25",
    "MIN_BLINK_FPS = 24",
    "blink floor lowered: 24 fps sessions would report counts they cannot support",
    "test/core/fpsGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "MIN_BLINK_FPS = 25",
    "MIN_BLINK_FPS = 26",
    "blink floor raised: honest 25 fps sessions would be refused",
    "test/core/fpsGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BLINK_RISK_FPS = 60",
    "BLINK_RISK_FPS = 30",
    "risk band collapsed: the sampling warning would go quiet where the misses are",
    "test/core/fpsGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "BLINK_RISK_CLEAR_FPS = 65",
    "BLINK_RISK_CLEAR_FPS = 60",
    "hysteresis removed: the warning would flick on and off at the boundary",
    "test/core/fpsGate.test.ts",
  ],
  [
    "src/core/constants.ts",
    "GUIDED_CALIBRATION_MIN_SAMPLES = 30",
    "GUIDED_CALIBRATION_MIN_SAMPLES = 3",
    "guided sample floor removed: three frames could draw a personal blink line",
    "test/core/guidedCalibration.test.ts",
  ],
  [
    "src/core/constants.ts",
    "GUIDED_CALIBRATION_MIN_SAMPLES = 30",
    "GUIDED_CALIBRATION_MIN_SAMPLES = 300",
    "guided sample floor bloated past a three second phase",
    "test/core/guidedCalibration.test.ts",
  ],
];

// The suite must be green BEFORE anything is bent, and a runner
// that cannot run must be told apart from a suite that went red:
// review demonstrated this script printing "All 18 mutations
// caught" with the test runner replaced by a nonexistent command,
// silent success inside the one tool whose job is refusing it.
function runSuite(testFile) {
  try {
    execSync(
      testFile === undefined ? "npx vitest run" : `npx vitest run ${testFile}`,
      { stdio: "pipe" },
    );
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
for (const [file, find, replace, why, owner] of MUTATIONS) {
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
    verdict = runSuite(owner);
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
    console.log(`caught by ${owner}: ${find.padEnd(36)} -> ${why}`);
  } else {
    survived += 1;
    console.error(
      `SURVIVED: ${find} -> ${replace} (${why}); ${owner} stayed green`,
    );
  }
}

if (survived > 0) {
  console.error(
    `\n${String(survived)} mutation(s) survived. Each one is a safety constant nothing pins.`,
  );
  process.exit(1);
}
console.log(`\nAll ${String(MUTATIONS.length)} mutations caught.`);
