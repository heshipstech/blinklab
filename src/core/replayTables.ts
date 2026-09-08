import type { MissFacts, MissSpan, TraceRow } from "./blinkReplay";

// Roadmap 10.8a3a. Reading and writing the two tables the replay
// runner joins, as pure string work.
//
// It is here rather than in `tools/` for the reason every core module
// is: this is rules, not disk. The disk half is four lines next door,
// and putting the parsing there would make it untestable without a
// filesystem and untyped besides, since the test tsconfig carries no
// node types.
//
// BOTH FORMATS ARE REAL AND COMMITTED, not invented here. The trace is
// what `serialiseFrameTrace` writes and `tools/measure_corpus.mjs`
// saves as `<clip>.frames.csv`. The miss table is the six-column shape
// of `docs/evidence/2026-08-21-rearm/eyeblink8_misses.csv`, which
// `analysis/tools/miss_autopsy.py` and `miss_overlap.py` already read.
// Parsing them loosely would invent a third dialect of a format two
// tools already agree on, and the whole point of this pipeline is that
// its tables join.

/** A miss with the clip it belongs to, as the committed table has it. */
export type MissTableRow = MissSpan & { clip: string };

/** A per-miss result with the clip it belongs to. */
export type MissFactsRow = MissFacts & { clip: string };

const TRACE_HEADER_START = "frameIndex";

/** A cell the exporter left empty means no measurement, not zero. */
function numberOrNull(cell: string | undefined): number | null {
  const text = (cell ?? "").trim();
  return text === "" ? null : Number(text);
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

/**
 * The rows of a corpus run's `<clip>.frames.csv`.
 *
 * Skips the metadata rows a real export begins with — `# source`,
 * `# clip`, `# measurement_mode` and six more — by finding the header
 * rather than assuming a line number. A reader that took line one as
 * the header would find no columns; one that took the first
 * comma-separated line would read a metadata value as data.
 *
 * `irisAspectRatio` is read and dropped. It is a second closure witness
 * the miss autopsy uses, and this pipeline is about the detector's
 * state rather than about the signal.
 *
 * Refuses a file whose header is not the trace's, and one with no rows
 * below it. The runner takes a directory of files named by convention,
 * and a wrong file parsed to an empty trace would report every miss as
 * never-crossed — a confident wrong answer, which is the failure this
 * project spends most of its guards on.
 */
export function parseTrace(text: string): TraceRow[] {
  const all = lines(text);
  const headerAt = all.findIndex((line) => line.startsWith(TRACE_HEADER_START));
  if (headerAt === -1) {
    throw new Error(
      "this is not a per-frame trace: no header row beginning " +
        `"${TRACE_HEADER_START}". A trace parsed as empty would report ` +
        "every miss as never-crossed, which is a confident wrong answer",
    );
  }
  const body = all.slice(headerAt + 1);
  if (body.length === 0) {
    throw new Error(
      "the trace has a header and no rows. An empty trace cannot say " +
        "what the detector did, and reporting it as though it could is " +
        "the failure this refusal exists for",
    );
  }
  return body.map((line) => {
    const cells = line.split(",");
    return {
      frameIndex: Number(cells[0]),
      mediaTimeSeconds: Number(cells[1]),
      apertureMm: numberOrNull(cells[2]),
      blinkLineMm: numberOrNull(cells[3]),
    };
  });
}

const MISS_TABLE_COLUMNS = ["clip", "blink_id", "startFrame", "endFrame"];

/**
 * The rows of a committed miss table.
 *
 * Order is preserved and nothing is grouped: the runner decides how to
 * walk them, and a parser that reorganised its input would make the
 * output table's row order a property of this file rather than of the
 * evidence.
 *
 * `blink_id` stays TEXT. It is an identifier that joins two tables, and
 * reading it as a number would make "007" and "7" the same row here and
 * different rows in the Python tools.
 */
export function parseMissTable(text: string): MissTableRow[] {
  const all = lines(text);
  const header = (all[0] ?? "").split(",").map((cell) => cell.trim());
  const missing = MISS_TABLE_COLUMNS.filter(
    (column) => !header.includes(column),
  );
  if (missing.length > 0) {
    throw new Error(
      `the miss table is missing ${missing.join(", ")}. Those are the ` +
        "columns this joins on, and a table without them cannot be " +
        "matched to a trace at all",
    );
  }
  const at = (name: string): number => header.indexOf(name);
  return all.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      clip: (cells[at("clip")] ?? "").trim(),
      blinkId: (cells[at("blink_id")] ?? "").trim(),
      startFrame: Number(cells[at("startFrame")]),
      endFrame: Number(cells[at("endFrame")]),
    };
  });
}

/**
 * The output table's columns.
 *
 * The same refusal 10.8a2 makes, held at the format boundary as well:
 * there is no mechanism column, and a test pins this list so one
 * cannot be smuggled in by the writer after the reader refused it.
 */
export const MISS_FACTS_COLUMNS = [
  "clip",
  "blink_id",
  "startFrame",
  "endFrame",
  "crossingFrame",
  "reopenFrame",
  "crossingToReopenMs",
  "msSincePreviousBlink",
  "rearmedAtCrossing",
];

function cell(value: number | boolean | string | null): string {
  // An empty cell for null, which is the trace format's own convention.
  // Not "null", not "NA", not 0: two conventions in one pipeline is how
  // a reader learns to guess.
  return value === null ? "" : String(value);
}

/**
 * The per-miss table, ready to commit as evidence.
 *
 * CRLF and a trailing newline, matching `serialiseFrameTrace` and the
 * exports this joins to.
 */
export function serialiseMissFacts(rows: readonly MissFactsRow[]): string {
  const out = [MISS_FACTS_COLUMNS.join(",")];
  for (const row of rows) {
    out.push(
      [
        row.clip,
        row.blinkId,
        cell(row.startFrame),
        cell(row.endFrame),
        cell(row.crossingFrame),
        cell(row.reopenFrame),
        cell(row.crossingToReopenMs),
        cell(row.msSincePreviousBlink),
        cell(row.rearmedAtCrossing),
      ].join(","),
    );
  }
  return out.join("\r\n") + "\r\n";
}
