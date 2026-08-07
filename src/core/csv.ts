import type { FeatureRecord } from "./featureRecord";

// The export border. One session becomes one file: a person can open
// it in a spreadsheet, and Phase 7's Python can load it without
// asking this project anything. That makes the column order a
// contract, not a detail, which is why it lives here as an exported
// constant with a test that compares it against the record's own
// field set: a field that joins the record without joining this list
// would vanish silently on the way out.
export const CSV_COLUMNS = [
  "timestampMs",
  "faceDetected",
  "fps",
  "apertureMm",
  "baselineMm",
  "shutBaselineMm",
  "blinkRatePerMin",
  "lastBlinkDurationMs",
  "lastBlinkAmplitudeMm",
  "lastBlinkPeakVelocityMmPerS",
  "perclos",
  "longClosureCount",
  "fixationCount",
  "fixationMedianMs",
  "fixating",
  "onScreen",
] as const satisfies readonly (keyof FeatureRecord)[];

// `satisfies` rejects a column name that is not a field, but it
// cannot demand that every field HAS a column, and the runtime
// column test cannot see an OPTIONAL new field either, because an
// optional field does not force the test fixtures to change. This
// assertion closes both holes at compile time: add a field to
// FeatureRecord without adding it here and the build fails.
type Assert<T extends true> = T;
type UncoveredField = Exclude<
  keyof FeatureRecord,
  (typeof CSV_COLUMNS)[number]
>;
export type EveryFieldHasAColumn = Assert<
  [UncoveredField] extends [never] ? true : false
>;

// One value to one field, per RFC 4180. The three rules a naive
// join gets wrong: null is an EMPTY field and never the word "null"
// (a reader parsing that as a number gets NaN, and nothing was
// measured is not a number); a field containing a comma, a quote or
// a line break must be quoted; and a quote inside a quoted field is
// escaped by doubling it, not by a backslash. Getting the last one
// wrong corrupts every column after it on that row.
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    // NaN and the infinities are refused by the FeatureRecord schema
    // upstream, so reaching here means something broke. They must
    // not be written as the words "NaN" or "Infinity": pandas reads
    // "NaN" as a missing value, which would make a broken
    // computation indistinguishable from an honest "not measured",
    // and "Infinity" turns a numeric column into text. An empty
    // field at least keeps the file's own rules.
    if (!Number.isFinite(value)) {
      return "";
    }
    // Object.is separates -0 from 0, which would otherwise export as
    // "0" here and "-0" elsewhere depending on the engine.
    return Object.is(value, -0) ? "0" : String(value);
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvHeader(): string {
  return CSV_COLUMNS.join(",");
}

// The whole session, header first. CRLF because RFC 4180 says so and
// because Excel is the most likely first reader. Null for an empty
// session: a file containing only a header claims a recording
// happened, which is the export's version of a fake zero.
export function serializeRecords(
  records: readonly FeatureRecord[],
  // Session-level facts (6.8's KSS answers) as `# key: value` lines
  // above the header. Per-session data must not become a per-second
  // column repeated three thousand times, and a comment block is
  // what both pandas (comment="#") and a spreadsheet can survive.
  metadataRows: readonly string[] = [],
): string | null {
  if (records.length === 0) {
    return null;
  }
  const lines = [...metadataRows, csvHeader()];
  for (const record of records) {
    lines.push(CSV_COLUMNS.map((column) => csvCell(record[column])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
