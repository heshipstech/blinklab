import { describe, expect, it } from "vitest";

import { deployTriggers, readWorkflow } from "../../tools/deployGuard.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.1e, ladder D5. The deploy workflow published on every push
// to main, and the build job it ran did two things: install and build.
// Every guard in this repository — the lint, the types, the suite, the
// coverage floor, the bundle budget, the mutation runner, the end to
// end specs — lives in a different workflow with no power to stop that
// publish. Pages went live about four minutes before CI finished, so a
// merge that turned out to be red was already the live site.
//
// The fix is a trigger, not a check: deploy runs when CI COMPLETES on
// main and only when it succeeded. That means two things have to be
// carried by hand, and both are easy to leave out. On a `workflow_run`
// the checkout defaults to the branch tip, not the commit CI actually
// tested, and `GITHUB_SHA` is the tip as well — and `vite.config.ts`
// reads that variable to stamp the build's commit into the page. Get
// either wrong and the published page reports a commit nobody tested.
//
// A workflow file is not executed by the suite, so nothing else here
// can notice any of that. This reads it.

const root = repoRoot();
const deploy = readWorkflow("deploy.yml", root);
const ci = readWorkflow("ci.yml", root);

describe("Pages waits for CI", () => {
  it("triggers on CI completing, not on the push itself", () => {
    const triggers = deployTriggers(deploy);
    expect(triggers).toContain("workflow_run");
    expect(triggers).toContain("workflow_dispatch");
    expect(
      triggers,
      "a push trigger publishes before any guard has run",
    ).not.toContain("push");
  });

  it("watches the workflow that actually runs the guards", () => {
    // The name is matched as a string by GitHub, so a rename of the CI
    // workflow with no matching rename here would silently stop every
    // deployment. Both sides are read from disk.
    const ciName = /^name:\s*(.+)$/m.exec(ci)?.[1]?.trim();
    expect(ciName).toBeDefined();
    expect(deploy).toContain(`workflows: ["${ciName ?? ""}"]`);
    expect(deploy).toContain("types: [completed]");
    expect(deploy).toContain("branches: [main]");
  });

  it("publishes only a run that succeeded", () => {
    // `types: [completed]` fires on failure and cancellation too, so
    // without this condition the change would make things worse: a red
    // CI would still publish, just later.
    expect(deploy).toContain(
      "github.event.workflow_run.conclusion == 'success'",
    );
  });

  it("builds the commit CI tested, not the branch tip", () => {
    // Two merges in a minute and the tip is not the tested commit.
    expect(deploy).toContain("ref: ${{ github.event.workflow_run.head_sha }}");
  });

  it("stamps that same commit into the page", () => {
    // vite.config.ts reads GITHUB_SHA for the provenance meta tag, and
    // on a workflow_run the ambient value is the tip rather than the
    // commit being built. Without this the page would report a commit
    // it was not built from, which is worse than reporting none.
    expect(deploy).toContain(
      "GITHUB_SHA: ${{ github.event.workflow_run.head_sha }}",
    );
  });

  it("still reads GITHUB_SHA where the stamp is written", () => {
    // If the build ever stops reading it, the line above is decoration.
    expect(readRepoFile("vite.config.ts", root)).toContain(
      "process.env.GITHUB_SHA",
    );
  });
});

describe("the trigger reader itself", () => {
  it("finds every trigger, and only the top-level ones", () => {
    expect(
      deployTriggers(
        [
          "name: X",
          "on:",
          "  push:",
          "    branches: [main]",
          "  workflow_dispatch:",
          "jobs:",
          "  build:",
        ].join("\n"),
      ),
    ).toEqual(["push", "workflow_dispatch"]);
  });

  it("refuses a file with no trigger block rather than reporting none", () => {
    expect(() => deployTriggers("name: X\njobs:\n  build:\n")).toThrow(/on:/);
  });
});
