import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import {
  assessSession,
  type VerdictInputs,
} from "../../src/core/sessionVerdict";
import { FIXTURES, fixtureVerdictInputs } from "../support/verdictFixtures";

// The TypeScript half of the verdict pin, increment 5 of the pilot
// (docs/assessment-pilot-plan.md). The committed fixtures under
// test/fixtures/verdict/ hold a synthetic session CSV beside the
// canonical verdict JSON, and BOTH implementations must reproduce
// the JSON byte for byte: this side from page state, the Python side
// (analysis/blinklab/verdict.py) from the CSV alone. A mutation on
// either side lands on the same committed bytes — mutations both
// directions, through one file.
//
// The page-state inputs are no longer written here. Roadmap 10.1f5:
// they are derived from the same object the CSV beside them is built
// from (test/support/verdictFixtures.ts), because the comment this
// replaces conceded the design — "if a literal and its CSV ever drift
// apart, one side stops matching" — and they had drifted. Two
// descriptions of one session kept in step by attention is one
// description too many.

const root = repoRoot();

function expected(name: string): string {
  return readRepoFile(`test/fixtures/verdict/${name}-verdict.json`, root);
}

function canonical(inputs: VerdictInputs): string {
  return `${JSON.stringify(assessSession(inputs), null, 2)}\n`;
}

function fixture(name: string): VerdictInputs {
  const session = FIXTURES.find((candidate) => candidate.name === name);
  if (session === undefined) {
    throw new Error(`no fixture session called ${name}`);
  }
  return fixtureVerdictInputs(session);
}

describe("the shared verdict fixture", () => {
  for (const session of FIXTURES) {
    it(`the ${session.name} session reproduces the committed bytes`, () => {
      expect(canonical(fixtureVerdictInputs(session))).toBe(
        expected(session.name),
      );
    });
  }

  it("the edge session's raw rate lands on the other side of the floor", () => {
    // Roadmap 10.15 (audit G-export/l-1). The export writes sampled_fps
    // to one decimal, so a measured 24.96 reaches the file as "25.0"
    // and the Python mirror reads 25.0: warned, not refused. The page
    // used to hand the verdict the raw double and said refused for the
    // same session, and pilot.py stopped the whole cohort calling that
    // disagreement an instrument defect. This is the mechanism stated:
    // it is why the rounding must happen on the page, not only in the
    // file.
    const raw = { ...fixture("edge"), sampledFps: 24.96 };
    expect(JSON.parse(canonical(raw)).headline).toBe("refused");
    expect(JSON.parse(expected("edge")).headline).not.toBe("refused");
  });

  it("the page hands the verdict the rate as the export writes it", () => {
    // The wiring pin: participantVerdictInputs must round sampledFps
    // through asExported, exactly as it already does for the marker
    // seconds, so both implementations compute from one number.
    const main = readRepoFile("src/main.ts", root);
    const start = main.indexOf("function participantVerdictInputs");
    const end = main.indexOf("processingFps:", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = main.slice(start, end);
    expect(body).toContain("asExported(rates.sampledFps, 1)");
  });

  it("the export path derives no verdict", () => {
    // DERIVED, NEVER EXPORTED: the report panel (increment 6) may
    // assess the session, but the exporter may not — a summary that
    // travelled beside its inputs would eventually disagree with
    // them. So the guard narrowed from "main.ts never touches the
    // verdict" to "exportSession's body never does", exactly as its
    // earlier form instructed.
    const main = readRepoFile("src/main.ts", root);
    const start = main.indexOf("function exportSession");
    const end = main.indexOf("// The participant report");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const exportBody = main.slice(start, end);
    expect(exportBody).not.toContain("assessSession");
    expect(exportBody).not.toContain("buildParticipantReport");
    // And the metadata builders stay fact-only: the pure module the
    // exporter composes rows from must not import the verdict.
    const metadata = readRepoFile("src/core/sessionMetadata.ts", root);
    expect(metadata).not.toContain("sessionVerdict");
  });

  it("one fact, one capture: the session's delivery rates", () => {
    // The dry run's instrument defect (docs/pilot-dry-run.txt): the
    // sampled rate appeared as three numbers because three consumers
    // each called deliveryRates() at their own moment against a
    // rolling window. The export, the report's verdict and the
    // report's conditions must all read ONE capture, so main.ts may
    // carry exactly two live call sites: the on-screen readout while
    // running, and the single settled capture everything else reads.
    const main = readRepoFile("src/main.ts", root);
    const calls = main.match(/deliveryRates\(/g) ?? [];
    expect(calls.length).toBe(2);
    expect(main).toContain("function settledDeliveryRates");
  });

  it("the capture happens at the session's end, before the observer stops", () => {
    // Roadmap 14.0d (audit A18): captured by the first consumer, the
    // rate depended on how fast the operator clicked after Stop. The
    // Stop handler and the camera-stopped route both settle it while
    // the observer's window still holds the last five seconds.
    const main = readRepoFile("src/main.ts", root);
    expect(main).toMatch(
      /settledDeliveryRates\(\);\n\s*setState\(\{ kind: "ended" \}\);/,
    );
    expect(main).toMatch(
      /settledDeliveryRates\(\);\n\s*setState\(\{ kind: "cameraStopped", reason \}\);/,
    );
  });
});
