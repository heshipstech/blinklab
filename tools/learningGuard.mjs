import { execFileSync } from "node:child_process";

// Remediation F1, the second half. The Definition of Done said every
// increment teaches one concept into LEARNING.md, and it held for a
// hundred and thirty pull requests on nothing but intent. It lapsed at
// #134 and nobody noticed for weeks, which is what a convention with
// no mechanism always eventually does. LEARNING 0.6 is an essay in
// this repository titled "conventions become mechanisms"; this is that
// essay applied to itself.
//
// The rule: a pull request that changes src/ either changes LEARNING.md
// too, or says in a commit message why it does not. The escape hatch is
// deliberate and it is not a loophole. Plenty of real changes teach
// nothing, a rename, a dependency bump, a revert, and a rule with no
// way out gets satisfied by a paragraph of filler, which is worse than
// silence: it puts noise in the one file a reader is meant to trust.
// Writing "No LEARNING entry: mechanical rename" costs a line and
// leaves a record of the judgement.
//
// The waiver is searched in COMMIT MESSAGES rather than the pull
// request body, so the reason lives in the repository rather than in
// GitHub's database, and `git log` still explains the gap years later.

/** Any change under src/ is an increment for this purpose. */
export function touchesSource(changedFiles) {
  return changedFiles.some((file) => file.startsWith("src/"));
}

/** Whether the same change also wrote to the learning record. */
export function touchesLearning(changedFiles) {
  return changedFiles.includes("LEARNING.md");
}

/**
 * The stated reason for skipping an entry, or null.
 *
 * The marker must be followed by something. "No LEARNING entry:" alone
 * is not a reason, it is the shape of one, and accepting it would turn
 * the escape hatch into the loophole this guard is written to avoid.
 */
export function waiverReason(commitMessages) {
  for (const message of commitMessages) {
    const match = message.match(/No LEARNING entry:[ \t]*(\S.*)/i);
    if (match) {
      return (match[1] ?? "").trim();
    }
  }
  return null;
}

/**
 * The verdict, as data rather than as an exit code, so the decision is
 * testable without running git or exiting a process.
 */
export function verdict(changedFiles, commitMessages) {
  if (!touchesSource(changedFiles)) {
    return { ok: true, why: "no src/ change, nothing to teach" };
  }
  if (touchesLearning(changedFiles)) {
    return { ok: true, why: "LEARNING.md changed with the source" };
  }
  const reason = waiverReason(commitMessages);
  if (reason !== null) {
    return { ok: true, why: `waived: ${reason}` };
  }
  return {
    ok: false,
    why: "src/ changed, LEARNING.md did not, and no commit message says why not. Add the entry, or write a line beginning 'No LEARNING entry:' followed by the reason.",
  };
}

/** Files changed between a base commit and HEAD. */
export function changedFilesSince(baseSha, root) {
  const out = execFileSync(
    "git",
    ["diff", "--name-only", `${baseSha}...HEAD`],
    { cwd: root, encoding: "utf8" },
  );
  return out.split("\n").filter((line) => line.length > 0);
}

/** Commit messages between a base commit and HEAD. */
export function commitMessagesSince(baseSha, root) {
  const out = execFileSync(
    "git",
    ["log", "--format=%B%x00", `${baseSha}..HEAD`],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  return out.split("\0").filter((part) => part.trim().length > 0);
}
