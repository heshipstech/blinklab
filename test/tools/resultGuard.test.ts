import { describe, expect, it } from "vitest";

import {
  actualPythonTestCount,
  actualUnitTestCount,
  isShallowRepo,
  lastCommitDateFor,
  newestStampDate,
  parseResultFile,
  runningInCi,
  readRepoFile,
  repoRoot,
  statedPythonTestCount,
  statedUnitTestCount,
  uncertaintySection,
} from "../../tools/resultGuard.mjs";

// The August 2026 audit found every headline number right and the prose
// around them rotten: the reproduction command printed the retired
// 82.8%, the withdrawn-glasses paragraph printed the superseded run's
// split while calling it corrected, and three documents carried two
// different test counts, 442 and 461, neither the suite's. Each sentence was true once and the run
// changed underneath it.
//
// These tests hold the summary documents to the committed result file,
// docs/eyeblink8-result.txt, so drifting from it is a red build rather
// than a finding in the next audit.

const root = repoRoot();
const run = parseResultFile(readRepoFile("docs/eyeblink8-result.txt", root));

const readme = readRepoFile("README.md", root);
const state = readRepoFile("STATE.md", root);
const modelCard = readRepoFile("MODEL_CARD.md", root);
const architecture = readRepoFile("ARCHITECTURE.md", root);

describe("parseResultFile", () => {
  it("reads the current run, which sits above the superseded one", () => {
    // The file keeps old runs below the current one on purpose, so a
    // parser that grabbed the LAST match would resurrect a retired
    // number. Pin the shape rather than the values: found blinks out of
    // annotated, and the miss subset inside the miss total.
    expect(run.found).toBeGreaterThan(0);
    expect(run.found).toBeLessThanOrEqual(run.annotated);
    expect(run.missFullyClosed).toBeLessThanOrEqual(run.missTotal);
    expect(run.reproDir.startsWith("eyeblink8-measured-")).toBe(true);
  });

  it("refuses a result file it cannot parse, rather than skipping", () => {
    expect(() => parseResultFile("not a result file")).toThrow(
      /could not find/,
    );
  });
});

describe("the model card's measurement-uncertainty section", () => {
  // Roadmap 10.1b. The published precision is a property of the video
  // preparation as much as of the detector, and blink duration is
  // device-conditioned with the mechanism open. Those conditions ARE
  // part of the numbers, so the card must state them in terms this
  // guard can hold to the committed results — a card that drifts from
  // the result file is a red build, not a future audit finding.

  it("extracts the section and stops at the next heading", () => {
    const text =
      "## Measurement uncertainty\n\nconditioned.\n\n## Intended use\n\nnope";
    expect(uncertaintySection(text)).toContain("conditioned");
    expect(uncertaintySection(text)).not.toContain("nope");
  });

  it("returns null when the card has no such section", () => {
    expect(uncertaintySection("## Privacy\n\nwords")).toBeNull();
  });

  it("exists in the committed card", () => {
    expect(
      uncertaintySection(modelCard),
      "MODEL_CARD.md has lost its Measurement uncertainty section",
    ).not.toBeNull();
  });

  it("carries the result file's own false-alarm count, not a stale one", () => {
    // The preparation-conditioning sentence quotes the invented count.
    // A corpus re-measure that moves it must move the card too.
    const section = uncertaintySection(modelCard) ?? "";
    const stated = section.match(/(\d+) invented/);
    expect(stated, "the section quotes no invented count").not.toBeNull();
    expect(Number((stated as RegExpMatchArray)[1])).toBe(run.invented);
  });

  it("names both measured conditions with their committed numbers", () => {
    const section = uncertaintySection(modelCard) ?? "";
    // The preparation finding: a 12.4-point precision gap between the
    // committed remux and re-encoded derivatives of the same files.
    expect(section).toContain("preparation");
    expect(section).toContain("12.4");
    // The device finding: iPhones ~96 ms, Macs 149 to 166 ms, on the
    // same scripted protocol (docs/validation-dry-run.txt).
    expect(section).toContain("96 ms");
    expect(section).toContain("149");
    expect(section).toContain("166");
  });
});

describe("the summary documents agree with the result file", () => {
  it("README, STATE and MODEL_CARD all carry the current recall and precision", () => {
    for (const doc of [readme, state, modelCard]) {
      expect(doc).toContain(`${run.recallPercent}%`);
      expect(doc).toContain(`${run.precisionPercent}%`);
    }
  });

  it("README's glasses paragraph uses the current run's split", () => {
    expect(readme).toContain(`${run.glasses.recall}% recall`);
    expect(readme).toContain(`${run.noGlasses.precision}%`);
  });

  it("STATE's reproduction command points at the run the file reports", () => {
    // This is the defect that motivated the guard: the command printed
    // 82.8% because it still named the retired dataset directory.
    const commandBlock = state.slice(
      state.indexOf("## How the Track A number is produced"),
    );
    expect(commandBlock).toContain(run.reproDir);
  });

  it("README and MODEL_CARD carry the rebuilt miss figure, not the retired one", () => {
    expect(readme).toContain(`${run.missPercent}%`);
    expect(modelCard).toContain(`${run.missPercent}%`);
    expect(modelCard).toContain(
      `${run.missFullyClosed} of the ${run.missTotal}`,
    );
  });
});

describe("published test counts match the suites", () => {
  it("counts this suite the way the runner does", () => {
    // If the static count ever disagrees with what `vitest run` reports,
    // this guard is counting wrong and every doc check after it is
    // meaningless. The runner reported 486 when this was written; the
    // floor pins that the walker keeps finding real files, so a broken
    // walker cannot return 0 and quietly agree with everything.
    expect(actualUnitTestCount(root)).toBeGreaterThanOrEqual(486);
  });

  it("every document that states a unit test count states the real one", () => {
    const actual = actualUnitTestCount(root);
    for (const [name, doc] of [
      ["README.md", readme],
      ["STATE.md", state],
      ["ARCHITECTURE.md", architecture],
    ] as const) {
      const stated = statedUnitTestCount(doc);
      if (stated !== null) {
        expect(stated, `${name} states ${stated} unit tests`).toBe(actual);
      }
    }
  });

  it("every document that states a Python test count states the real one", () => {
    const actual = actualPythonTestCount(root);
    for (const doc of [readme, state]) {
      const stated = statedPythonTestCount(doc);
      if (stated !== null) {
        expect(stated).toBe(actual);
      }
    }
  });
});

describe("the dated stamps", () => {
  // MODEL_CARD.md's stamp converted an audit finding from a
  // contradiction into a correctly scoped snapshot. README.md and
  // STATE.md carry one now, and the rule is: when a stamped file
  // changes, its stamp changes with it.
  const stamped = [
    ["README.md", readme],
    ["STATE.md", state],
    ["MODEL_CARD.md", modelCard],
  ] as const;

  it("parses stamp dates and ignores ordinary prose dates", () => {
    expect(
      newestStampDate(
        "Written 9 August 2026, revised 11 August 2026, against the state of `main` on that date.",
      ),
    ).toBe("2026-08-11");
    expect(newestStampDate("Stamped: 2 March 2027.")).toBe("2027-03-02");
    // A date without a stamp word is prose, not a stamp.
    expect(newestStampDate("The audit ran on 10 August 2026.")).toBeNull();
    // A stamp word in prose is still prose without the stamp sentence.
    expect(
      newestStampDate("the application, revised 28 August 2026, was sent"),
    ).toBeNull();
    expect(
      newestStampDate("the draft remained unrevised 12 August 2026"),
    ).toBeNull();
    // The two real stamp shapes both parse.
    expect(
      newestStampDate(
        "Revised 11 August 2026, against the state of `main` on that date.",
      ),
    ).toBe("2026-08-11");
  });

  it("every summary document carries a parseable stamp", () => {
    for (const [name, doc] of stamped) {
      expect(newestStampDate(doc), `${name} has no stamp`).not.toBeNull();
    }
  });

  it("no stamp is in the future", () => {
    // One day of slack: a commit made late in the evening carries the
    // next day's date in UTC.
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (const [name, doc] of stamped) {
      const stamp = newestStampDate(doc);
      expect(
        stamp !== null && stamp <= tomorrow,
        `${name} is stamped in the future: ${stamp}`,
      ).toBe(true);
    }
  });

  it("runs with full history in CI, so the staleness check cannot vanish", () => {
    // The staleness comparison below must skip on a shallow checkout,
    // and a skip that nobody sees is this project's recurring defect,
    // silent success. This pin makes losing ci.yml's fetch-depth: 0 a
    // red build in CI rather than a guard that quietly evaporated.
    if (runningInCi()) {
      expect(isShallowRepo(root)).toBe(false);
    }
  });

  it("a stamped file that changed carries a fresh stamp", () => {
    if (isShallowRepo(root)) {
      // A depth-1 checkout reports every file as touched by the tip
      // commit, which would demand a stamp bump on every pull request.
      // Skipping here is safe only because the pin above turns a
      // shallow CI into a failure.
      return;
    }
    for (const [name] of stamped) {
      const stamp = newestStampDate(readRepoFile(name, root));
      const committed = lastCommitDateFor(name, root);
      if (stamp === null || committed === null) {
        continue;
      }
      // Two days of slack, and the rule it implies: a pull request
      // touching a stamped file must MERGE within two days of its
      // stamp, or bump the stamp. The squash commit takes the merge
      // date, not the author date, so a PR that sits open longer than
      // that goes red on main with exactly this message.
      const slackStart = new Date(
        new Date(`${committed}T00:00:00Z`).getTime() - 2 * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      expect(
        stamp >= slackStart,
        `${name} changed on ${committed} but is stamped ${stamp}`,
      ).toBe(true);
    }
  });
});
