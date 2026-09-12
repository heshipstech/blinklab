import { describe, expect, it } from "vitest";

import { repoRoot } from "../../tools/resultGuard.mjs";
import {
  idleLabels,
  missingFiles,
  provenanceCitations,
  provenanceKeys,
  provenanceTableSlice,
  readSource,
} from "../../tools/provenanceGuard.mjs";
import { citedDocs } from "../../src/core/docCitations";
import { METRIC_PROVENANCE } from "../../src/core/metricProvenance";

// Roadmap 14.3's Check, verbatim: a CI guard iterates the provenance
// table — every metric has an entry, and every evidence-bearing
// status names an existing docs/ result file. The unit tests beside
// the table hold it to the idle registry at runtime; this file is the
// disk half, reading the COMMITTED source and the real repository,
// because a citation is only worth rendering while the file it names
// exists.

const root = repoRoot();
const coreSource = readSource("src/core/metricProvenance.ts", root);
const idleSource = readSource("src/core/idleStrings.ts", root);

describe("every metric has an entry, read from the committed source", () => {
  it("finds the table and a real number of keys", () => {
    // The floor pins that the reader keeps finding real entries, so a
    // broken pattern cannot return nothing and agree with everything.
    expect(provenanceTableSlice(coreSource)).not.toBeNull();
    expect(provenanceKeys(coreSource).length).toBeGreaterThanOrEqual(16);
    expect(idleLabels(idleSource).length).toBeGreaterThanOrEqual(16);
  });

  it("holds the table's keys to the idle readouts, both directions", () => {
    expect([...provenanceKeys(coreSource)].sort()).toEqual(
      [...idleLabels(idleSource)].sort(),
    );
  });

  it("reads quoted keys and bare keys alike", () => {
    const table =
      "export const METRIC_PROVENANCE = {\n" +
      '  "Alertness score": {\n  },\n' +
      "  Blinks: {\n  },\n" +
      "};\n";
    expect(provenanceKeys(table)).toEqual(["Alertness score", "Blinks"]);
  });

  it("reports an absent table as null rather than as empty and fine", () => {
    expect(provenanceTableSlice("export const OTHER = {};")).toBeNull();
    expect(provenanceKeys("export const OTHER = {};")).toEqual([]);
  });
});

describe("every cited document exists in the repository", () => {
  it("finds the citations the table makes", () => {
    expect(provenanceCitations(coreSource).length).toBeGreaterThan(5);
  });

  it("names no file the repository does not carry", () => {
    expect(
      missingFiles(provenanceCitations(coreSource), root),
      "documents the provenance table cites that do not exist",
    ).toEqual([]);
  });

  it("would report a citation of a file that is not there", () => {
    expect(missingFiles(["docs/never-written.txt"], root)).toEqual([
      "docs/never-written.txt",
    ]);
  });

  it("sees in the source every citation the runtime sees", () => {
    // The trap this pin exists for: prettier wraps long literals, and
    // a docs/ path split across two string pieces vanishes from a
    // source-text match with nothing going red. The runtime joins the
    // pieces back together, so the two counts disagree exactly when a
    // path has been split.
    const atRuntime = Object.values(METRIC_PROVENANCE).flatMap((entry) =>
      citedDocs(entry.status),
    );
    expect([...provenanceCitations(coreSource)].sort()).toEqual(
      [...atRuntime].sort(),
    );
  });
});
