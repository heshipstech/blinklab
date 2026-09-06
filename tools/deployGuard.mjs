import { readFileSync } from "node:fs";
import { join } from "node:path";

// Roadmap 10.1e, ladder D5. The deploy workflow published on every push
// to main, and every guard this repository has lives in a different
// workflow with no power to stop that publish: Pages went live about
// four minutes before CI finished, so a merge that turned out to be red
// was already the live site.
//
// A workflow file is not executed by the test suite, so nothing in the
// suite can notice when its trigger, its success condition, or the
// commit it checks out drifts. This reads the file, the way uiGuard
// reads main.ts and claimGuard reads the tree.
//
// It lives here rather than in the test for the reason guardsArmed's
// reader does: the test tsconfig has no node types, so `readFileSync`
// in a .test.ts is `any` and every callback beside it loses its type.

/** A workflow file's text, by name, from .github/workflows. */
export function readWorkflow(name, root) {
  return readFileSync(join(root, ".github/workflows", name), "utf8");
}

/**
 * The top-level trigger names in a workflow's `on:` block.
 *
 * Read by indentation rather than by a YAML parser, which this project
 * does not depend on: the block runs from the `on:` line to the next
 * line in column zero, and a trigger is a key indented exactly two
 * spaces inside it. Throws rather than returning an empty list, because
 * a workflow whose triggers cannot be read is a finding, and a guard
 * that reports "no triggers" would read as "no push trigger" and pass.
 */
export function deployTriggers(workflowText) {
  const lines = workflowText.split("\n");
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (start === -1) {
    throw new Error("workflow: no top-level `on:` block to read triggers from");
  }
  const triggers = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) {
      break;
    }
    const match = /^ {2}([a-z_]+):/.exec(line);
    if (match !== null) {
      triggers.push(match[1]);
    }
  }
  if (triggers.length === 0) {
    throw new Error("workflow: the `on:` block names no trigger");
  }
  return triggers;
}
