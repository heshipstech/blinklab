// Roadmap 10.0b3, ladder B14 and D13. Two sentences in this
// repository restate what a machine-readable file already knows, and
// both were written by hand and left to age.
//
// CONTRIBUTING hands a contributor one command line and calls it the
// gates. `.github/workflows/ci.yml` is the file that decides what the
// gates are. When `npm run counts:check` was added to continuous
// integration in roadmap 10.0b1, CONTRIBUTING was not, so the
// documented line passed locally and the pull request failed on a
// step the contributor had never been told to run.
//
// README says which roadmap phases are complete. ROADMAP is the file
// that decides that. Same shape of drift, slower to notice, and
// louder when it is wrong, because that sentence is the first thing a
// reader of this project is told about its state.
//
// Same arrangement as the other guards: plain .mjs reading the disk,
// data out, callers type checked.

const RUN_LINE = /^\s*(?:-\s*)?run:\s*(.+?)\s*$/;
const JOB_LINE = /^ {2}([A-Za-z][\w-]*):\s*$/;

/**
 * The shell commands a named job in a workflow runs, in order.
 *
 * Both step shapes count. A bare `- run:` is a gate, and so is a
 * `- name:` with a `run:` under it: the Definition of Done check is
 * written that way and it is no less a gate for having a title.
 */
export function ciGates(workflowText, jobName) {
  const lines = workflowText.split("\n");
  const gates = [];
  let inside = false;
  let found = false;
  for (const line of lines) {
    const job = line.match(JOB_LINE);
    if (job !== null) {
      inside = job[1] === jobName;
      if (inside) found = true;
      continue;
    }
    if (!inside) continue;
    const run = line.match(RUN_LINE);
    if (run !== null) gates.push(run[1]);
  }
  if (!found) {
    throw new Error(
      `ci.yml: no job named ${jobName}. Reporting no gates would read ` +
        "as a job that runs nothing, which is what a typo and a deleted " +
        "job both look like",
    );
  }
  return gates;
}

/**
 * The commands CONTRIBUTING tells a contributor to run, taken from its
 * fenced blocks. A chained line holds several.
 *
 * Fenced blocks ONLY, and this was learned the hard way inside this
 * very row. The first version also read inline code spans, on the
 * reasoning that the install command was written inline and a reader
 * follows it there. That made the guard unable to fail: the paragraph
 * added beside the fix explains the drift and names
 * `npm run counts:check` in backticks while doing so, and the pin was
 * then satisfied by the explanation rather than by the command line.
 * Removing the gate from the block a contributor actually runs left
 * the suite green.
 *
 * So the rule is that a gate is documented where it is RUN, not where
 * it is discussed. Prose may say anything. The install command moved
 * into a block of its own instead.
 */
export function documentedGates(contributingText) {
  const commands = [];
  for (const block of contributingText.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const line of block[1].split("\n")) {
      for (const part of line.split("&&")) {
        const command = part.trim();
        if (command !== "") commands.push(command);
      }
    }
  }
  return commands;
}

const PHASE_HEADING = /^## Phase (\d+)\./;
const ROW = /^- \[([ x~])\] (.*)$/;
const MOVED = /^[\d.]+\s*\(moved to /;

/**
 * Whether a roadmap row is settled: done, declined, or moved
 * elsewhere. This repository marks three outcomes and writes the
 * fourth as prose, and a phase is finished when nothing in it is
 * still open.
 *
 * The moved shape is matched narrowly, at the head of the row and in
 * the exact words the file uses, so that ordinary prose about moving
 * something cannot quietly settle a row nobody did.
 */
export function rowSettled(marker, text) {
  if (marker === "x") return true;
  if (marker === "~") return true;
  return MOVED.test(text);
}

/**
 * The highest phase number such that every phase from 0 up to it has
 * all its rows settled: done, declined, or moved.
 *
 * The run has to be contiguous from zero. A later phase finishing
 * early must not advance the claim past a phase that is still open,
 * which is exactly how a summary comes to overstate what is done.
 */
export function phasesComplete(roadmapText) {
  const phases = new Map();
  let current = null;
  for (const line of roadmapText.split("\n")) {
    const heading = line.match(PHASE_HEADING);
    if (heading !== null) {
      current = Number(heading[1]);
      if (!phases.has(current)) phases.set(current, []);
      continue;
    }
    if (current === null) continue;
    const row = line.match(ROW);
    if (row !== null) phases.get(current).push(rowSettled(row[1], row[2]));
  }
  if (phases.size === 0) {
    throw new Error("ROADMAP.md: no phase headings, so nothing to count");
  }
  let complete = -1;
  for (let n = 0; phases.has(n); n += 1) {
    const rows = phases.get(n);
    if (rows.length === 0) {
      throw new Error(
        `ROADMAP.md: Phase ${n} has no rows. An empty phase is vacuously ` +
          "complete, which would let a heading written ahead of its rows " +
          "advance the published claim",
      );
    }
    if (!rows.every(Boolean)) break;
    complete = n;
  }
  return complete;
}

/** The phase number README's summary sentence claims is complete. */
export function statedPhasesComplete(readmeText) {
  const match = readmeText.match(/Phases 0 through (\d+) are complete/);
  if (match === null) {
    throw new Error(
      'README.md: no "Phases 0 through N are complete" sentence to hold ' +
        "ROADMAP to",
    );
  }
  return Number(match[1]);
}
