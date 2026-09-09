import { describe, expect, it } from "vitest";

import { CSV_COLUMNS } from "../../src/core/csv";
import { specRecordFields } from "../../tools/metadataKeys.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 12.15. SPEC.md carries the FeatureRecord contract as a
// TypeScript block, and it has fallen behind the type twice: increment
// 6.4's review caught fields that had landed without being recorded,
// and `baselineOverResting` landed on 23 August 2026 and was not
// written into the block until 6 September. Both times the document
// said the record was one thing and the export wrote another.
//
// A reader who opens a CSV opens SPEC.md next. So the block is held to
// the export's own column list, which the type system already holds to
// the record. Set equality, not order: the block groups fields by
// meaning and the column list is append-only by generation, so the two
// orders differ on purpose and demanding one would pin a coincidence.

const root = repoRoot();

describe("SPEC.md's record block and the export's columns", () => {
  it("finds the fields the block declares", () => {
    expect(specRecordFields(root).length).toBeGreaterThan(10);
  });

  it("names exactly the fields the export writes", () => {
    const documented = [...specRecordFields(root)].sort();
    const written = [...CSV_COLUMNS].sort();
    expect(documented).toEqual(written);
  });
});

describe("the evidence rate and the inference cost travel per second", () => {
  // Two facts about HOW a row was measured were available only once
  // per session, in a comment line above the header, or not at all.
  //
  // `sampledFps` — distinct camera frames read per second — is the
  // evidence rate the 25 fps refusal and the 60 fps warning both
  // judge, and the session-level line reports one number for a
  // recording that may have run at 30 for a minute and 12 for the
  // next. A reader cannot tell which rows are which.
  //
  // `inferenceMs` was nowhere. The processing rate is set by how long
  // the face model takes, so a row reporting a low `fps` says the
  // machine was slow without saying whether the model or the rest of
  // the loop was the reason.

  it("writes the evidence rate as its own column", () => {
    expect(CSV_COLUMNS).toContain("sampledFps");
  });

  it("writes the model's own cost as its own column", () => {
    expect(CSV_COLUMNS).toContain("inferenceMs");
  });

  it("appends them at the end, so an older header stays an exact prefix", () => {
    // The Python loader recognises each previous generation as an
    // exact prefix of the current one. Placing a new column beside a
    // related one instead of at the end would break every file
    // exported before today, a cost this project has already declined
    // three times (baselineOverResting, pupilDiameterMm, and the two
    // luminance columns row 12.16 appended after these).
    expect(CSV_COLUMNS.slice(-4, -2)).toEqual(["sampledFps", "inferenceMs"]);
  });

  it("keeps the luminance pair trailing, for the same reason", () => {
    expect(CSV_COLUMNS.slice(-2)).toEqual(["sceneLum", "faceLum"]);
  });
});
