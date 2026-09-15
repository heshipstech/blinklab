import { readFileSync } from "node:fs";
import { join } from "node:path";

// Roadmap 12.17, the column-freeze manifest for the v2 corpus read.
//
// The v2 read will publish numbers computed from specific per-second
// CSV columns, and a column renamed or removed underneath a running
// read is the drift this project keeps re-catching in prose. So the
// freeze is mechanical: docs/column-freeze.txt holds one line per
// field the owner has SIGNED IN, this guard compares every signed-in
// field against the live CSV_COLUMNS in src/core/csv.ts, and a signed
// field that is gone from the header goes red by name. Self-retiring
// on the drozyGuard pattern: the owner signs a field OUT with a date
// and its constraint lifts without its history being deleted.
//
// Two deliberate asymmetries. Signing is the OWNER's act — this file
// only reads the manifest, and the manifest landed with no signatures
// (roadmap 12.17: the tool and tests now, the dated freeze later). And
// the freeze binds only what is signed: a NEW column appended to the
// header breaks no signed read and is no violation, which is the same
// trailing-append discipline csv.ts already keeps for old files.
//
// Same arrangement as drozyGuard, resultGuard and claimGuard: plain
// .mjs reading the disk, verdicts as data, the test file is what CI
// runs, hand-written callers type checked.

/** The manifest's home, owner-editable. */
export const MANIFEST_PATH = "docs/column-freeze.txt";

/** Only lines below this heading are read as signatures, so the prose
 * explaining the format can show example lines without signing them. */
const SIGNATURES_HEADING = /^SIGNATURES\s*$/m;

/** One signature line: `field | signed in <date>` with an optional
 * ` | signed out <date>` tail. Dates are kept as the owner wrote them
 * — the guard keys on presence, not on parsing a calendar. */
const ENTRY =
  /^\s*(\w+)\s*\|\s*signed in\s+([^|]+?)\s*(?:\|\s*signed out\s+(.+?)\s*)?$/;

/**
 * The signature block: everything after the SIGNATURES heading, or
 * empty when the heading is gone. Empty is not an error here — the
 * repository test asserts the real manifest still HAS its heading, so
 * a deleted heading reddens there rather than silently unfreezing.
 */
export function signatureBlock(manifestText) {
  // Matched as a LINE, not a substring: the manifest's own prose
  // mentions the signatures block by name, and an indexOf would anchor
  // on that mention and swallow the how-to example lines below it —
  // this file's first local run caught exactly that.
  const at = manifestText.match(SIGNATURES_HEADING);
  return at === null ? "" : manifestText.slice(at.index ?? 0);
}

/** Every signature entry, as {field, signedIn, signedOut|null}. */
export function parseManifest(manifestText) {
  return signatureBlock(manifestText)
    .split("\n")
    .map((line) => ENTRY.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({
      field: match[1],
      signedIn: match[2],
      signedOut: match[3] ?? null,
    }));
}

/** The fields currently frozen: signed in and not signed out. */
export function frozenFields(manifestText) {
  return parseManifest(manifestText)
    .filter((entry) => entry.signedOut === null)
    .map((entry) => entry.field);
}

/**
 * The verdict, as data. `liveColumns` is the real header's field list;
 * every frozen field must still be in it. No frozen fields means no
 * constraint yet — true until the owner's first sign-in — and that is
 * an ok with its reason, never a silent pass.
 */
export function freezeVerdict(manifestText, liveColumns) {
  const frozen = frozenFields(manifestText);
  if (frozen.length === 0) {
    return {
      ok: true,
      why: "no fields are signed in, so the freeze holds no constraint yet",
    };
  }
  const live = new Set(liveColumns);
  const missing = frozen.filter((field) => !live.has(field));
  if (missing.length > 0) {
    return {
      ok: false,
      why:
        `signed-in columns missing from the live header: ${missing.join(", ")}. ` +
        "A signed field is one a read depends on: restore it, or have the " +
        `owner sign it out with a date in ${MANIFEST_PATH}.`,
    };
  }
  return { ok: true, why: "every signed-in column is in the live header" };
}

/**
 * The live per-second header, read from csv.ts's own source.
 *
 * Read rather than retyped, the drozyGuard rule: a column list kept by
 * hand inside a guard is a list that drifts from the code it claims to
 * guard. A reader-integrity test holds this parse to the imported
 * CSV_COLUMNS, so a reshaped literal cannot quietly empty the watch.
 */
export function liveColumns(root) {
  const source = readFileSync(join(root, "src/core/csv.ts"), "utf8");
  const block = source.match(/export const CSV_COLUMNS = \[([\s\S]*?)\]/);
  if (block === null) {
    throw new Error("csv.ts: could not find the CSV_COLUMNS array");
  }
  const clean = block[1].replace(/\/\/[^\n]*/g, "");
  return [...clean.matchAll(/"([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
}

/** The committed manifest's text. Throws when the file is gone: a
 * freeze whose manifest vanished is the defect, not a case to skip. */
export function readManifest(root) {
  return readFileSync(join(root, MANIFEST_PATH), "utf8");
}
