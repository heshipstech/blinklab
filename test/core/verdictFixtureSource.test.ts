import { describe, expect, it } from "vitest";

import { exportRowBuilders } from "../../tools/metadataKeys.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import {
  updateRequested,
  writeFixture,
} from "../../tools/writeVerdictFixtures.mjs";
import {
  FIXTURES,
  FIXTURE_ROW_BUILDERS,
  fixtureCsv,
} from "../support/verdictFixtures";

// Roadmap 10.1f5, ladder D6, audit G-export/l-9. The fixture CSVs come
// out of the exporter now, not out of a text editor.
//
// The verdict pin has always held two implementations to one file. It
// could not hold the FILE to anything: the CSVs were typed by hand, so
// they were a person's idea of what an export looks like rather than
// an export. That idea had already drifted — every one of them carried
// `# kss_before: 3` where the writer can emit only `3 (Alert)` or
// `skipped` — and nothing in the loop imported the metadata writers at
// all, so a renamed key left the whole pin green.
//
// Now the committed bytes are the exporter's own output for a
// described session, and this test says so. When a metadata change
// lands the fixtures go red here, are regenerated with
// `npm run fixtures:write`, and the Python mirror must still reproduce
// the committed verdict JSON from the new bytes. That last step is the
// point: it is the only thing that proves a metadata change did not
// quietly change a verdict.

const root = repoRoot();

describe("the verdict fixtures are the exporter's own output", () => {
  it("assembles them from the row builders the page uses, in its order", () => {
    // Every builder is called, including the ones a fixture session
    // gives nothing to. A builder added to the export and not here
    // would put keys in a real file that the fixtures never carry, and
    // the fixtures are what the two implementations agree about.
    expect(FIXTURE_ROW_BUILDERS).toEqual(exportRowBuilders(root));
  });

  for (const session of FIXTURES) {
    it(`the ${session.name} session reproduces its committed bytes`, () => {
      const path = `test/fixtures/verdict/${session.name}-session.csv`;
      const csv = fixtureCsv(session);
      if (updateRequested()) {
        writeFixture(path, csv, root);
      }
      expect(csv).toBe(readRepoFile(path, root));
    });
  }

  it("writes what the exporter writes, down to the line ending", () => {
    // The hand-typed fixtures used bare newlines; `serializeRecords`
    // writes CRLF. A fixture a text editor produced cannot exercise the
    // reader's handling of the line ending the exporter actually emits,
    // and the analysis track reads these files with the same code that
    // reads real ones.
    const csv = fixtureCsv(FIXTURES[0] as (typeof FIXTURES)[number]);
    expect(csv).toContain("\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("carries the KSS answers in the only form the writer can emit", () => {
    // The drift that named this row. `3` is not something `kss.ts` can
    // write; `3 (Alert)` is.
    const csv = fixtureCsv(FIXTURES[0] as (typeof FIXTURES)[number]);
    expect(csv).toContain("# kss_before: 3 (Alert)");
    expect(csv).not.toContain("# kss_before: 3\r");
  });

  it("names the build that wrote it, so a cohort of fixtures has one", () => {
    for (const session of FIXTURES) {
      expect(fixtureCsv(session)).toContain(
        `# app_commit: ${session.appCommit}`,
      );
    }
  });
});
