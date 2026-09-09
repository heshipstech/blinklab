import { missFacts } from "./blinkReplay";
import type { MissFacts, MissSpan, TraceRow } from "./blinkReplay";
import { FRAME_TRACE_COLUMNS } from "./frameTrace";

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

/**
 * A parsed miss-table row. `MissSpan` already carries the clip its
 * frame numbers count within, which is exactly what the committed
 * table's first column holds, so this is that span and nothing added.
 */
export type MissTableRow = MissSpan;

/** A per-miss result with the clip it belongs to. */
export type MissFactsRow = MissFacts & { clip: string };

/**
 * A cell the exporter left empty means no measurement, not zero.
 *
 * Anything else that is not a finite number is a DAMAGED file, not a
 * measurement, and is refused rather than passed on as NaN. NaN is
 * neither null nor below the line: `blinkStep` would take the OPEN
 * branch on it and `missFacts` would report the crossing as never
 * happening, so an unreadable frame would arrive in the table as the
 * autopsy's above-line story. The Python half of this pipeline,
 * `miss_autopsy.py`, already refuses the same cell — its `float()`
 * raises — so absorbing it here would make the two tools disagree
 * about one file, quietly.
 */
function numberOrNull(cell: string | undefined, column: string): number | null {
  const text = (cell ?? "").trim();
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error(
      `the trace's ${column} cell "${text}" is not a number. An empty ` +
        "cell means no measurement; anything else unreadable means a " +
        "damaged file, and reading it as NaN would report the frame as " +
        "eye-open and the miss as never-crossed",
    );
  }
  return value;
}

/**
 * A column every exported row carries: empty is damage too.
 *
 * `Number("")` is 0, not NaN, so a finiteness test alone would let a
 * missing frameIndex through as frame 0 — a row that joins to the
 * wrong place rather than to nowhere.
 */
function requiredNumber(cell: string | undefined, column: string): number {
  const value = numberOrNull(cell, column);
  if (value === null) {
    throw new Error(
      `the trace has a row with no ${column}. Every exported row carries ` +
        "one, so a row without it is a damaged or truncated file",
    );
  }
  return value;
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
 * as the first line that is not a `#` row. A reader that took line one
 * as the header would find no columns; one that took the first
 * comma-separated line would read a metadata value as data.
 *
 * The header is then held to `FRAME_TRACE_COLUMNS` EXACTLY, by name and
 * position, not by a prefix. A prefix match — the shape this replaced —
 * let `frameIndexSought,...` through, and, worse, said nothing about the
 * ORDER of the columns it then read positionally: a trace whose columns
 * were reordered on the writer's side would parse without a murmur, with
 * `apertureMm` taken from wherever `irisAspectRatio` now sat. Every
 * frame would read as eye-open and every miss as never-crossed. Pinning
 * the header to the writer's own constant makes the two files one
 * contract: the round-trip test proves it, and a column moved on either
 * side breaks the build rather than the numbers.
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
  const expected = FRAME_TRACE_COLUMNS.join(",");
  const header = all.find((line) => !line.startsWith("#"));
  if (header !== expected) {
    throw new Error(
      `this is not a per-frame trace: its header must read exactly ` +
        `"${expected}". A prefix match let "frameIndexSought,..." through, ` +
        "and reading a reordered header positionally takes apertureMm from " +
        "the irisAspectRatio column, so every frame reads as eye-open and " +
        "every miss as never-crossed — a confident wrong answer. A file of " +
        "only metadata, with no header at all, is refused here too",
    );
  }
  const body = all.slice(all.indexOf(header) + 1);
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
      frameIndex: requiredNumber(cells[0], "frameIndex"),
      mediaTimeSeconds: requiredNumber(cells[1], "mediaTimeSeconds"),
      apertureMm: numberOrNull(cells[2], "apertureMm"),
      blinkLineMm: numberOrNull(cells[3], "blinkLineMm"),
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

/**
 * Join a committed miss table to the traces a corpus run produced and
 * return the per-miss table as text: the whole replay runner, minus
 * the disk.
 *
 * `traceByClip` maps each clip's stem to its `<clip>.frames.csv` text.
 * The disk half in `tools/replayRunner.mjs` fills it by reading a
 * directory; here it is a plain map so the join is testable without a
 * filesystem, the same split every module in this folder keeps.
 *
 * REFUSES a miss table naming a clip the map does not hold, rather
 * than writing a shorter table. A clip present in the annotations and
 * absent from the traces is "we did not measure it", not "it had no
 * misses", and a table that quietly skipped it could not tell the two
 * apart — the difference this whole pipeline exists to keep. Clips are
 * walked in the order the table first names them, so the output's row
 * order is the table's, never this map's iteration order.
 */
export function joinMissFacts(
  missTableText: string,
  traceByClip: ReadonlyMap<string, string>,
): string {
  const spansByClip = new Map<string, MissSpan[]>();
  for (const row of parseMissTable(missTableText)) {
    const spans = spansByClip.get(row.clip);
    if (spans === undefined) {
      spansByClip.set(row.clip, [row]);
    } else {
      spans.push(row);
    }
  }
  const rows: MissFactsRow[] = [];
  for (const [clip, spans] of spansByClip) {
    const traceText = traceByClip.get(clip);
    if (traceText === undefined) {
      throw new Error(
        `the miss table names clip "${clip}" but the trace directory has ` +
          `no ${clip}.frames.csv. A clip annotated and not measured is "we ` +
          'did not look", not "no misses here", and skipping it would write ' +
          "a shorter table that cannot tell the two apart",
      );
    }
    const traceRows = parseTrace(traceText);
    for (const fact of missFacts(clip, traceRows, spans)) {
      rows.push({ ...fact, clip });
    }
  }
  return serialiseMissFacts(rows);
}
