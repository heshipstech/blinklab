import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LANDMARKER, landmarkerOptions } from "./modelProvenance.mjs";

// Roadmap amendment 18. A ladder that offers work it cannot deliver
// costs whoever picks the row exactly the time it takes to discover
// that, and then costs the next reader the same again, because
// nothing wrote it down.
//
// Five rows were tried that way in one session: one wanting a browser
// engine this project's automation does not install, one whose two
// named consumers a previous amendment had demoted, one wanting a
// model output the app does not ask for, one wanting recordings this
// repository deliberately does not keep, and one waiting on a decision
// about intent that is not anybody's to make from the record.
//
// So a row that cannot be STARTED says so in a marker a test can read,
// and the marker must name what would unblock it. "BLOCKED" alone is
// the same silence in a louder font.

const BLOCKED = /\*\*BLOCKED:\s*([^*]*)\*\*/;
const ROW = /^- \[([ x~])\] ([\d.]+[a-z]?\d*)\s/;

/**
 * The unticked rows carrying a blocked marker, each with what it says
 * would unblock it.
 *
 * Throws on a marker that names nothing, because a row that announces
 * it is stuck without saying on what leaves the next reader exactly
 * where an unmarked row would.
 */
export function blockedRows(roadmapText) {
  const rows = [];
  for (const line of roadmapText.split("\n")) {
    const row = line.match(ROW);
    if (row === null || row[1] !== " ") continue;
    const marker = line.match(BLOCKED);
    if (marker === null) continue;
    const reason = marker[1].trim();
    if (reason === "") {
      throw new Error(
        `ROADMAP.md row ${row[2]}: a BLOCKED marker that names nothing. ` +
          "A row announcing it is stuck without saying on what leaves the " +
          "next reader exactly where an unmarked row would",
      );
    }
    rows.push({ id: row[2], reason });
  }
  return rows;
}

/** One row's whole line, by its number. Throws when it is not there. */
export function roadmapRow(roadmapText, id) {
  for (const line of roadmapText.split("\n")) {
    const row = line.match(ROW);
    if (row !== null && row[2] === id) return line;
  }
  throw new Error(
    `ROADMAP.md: no row ${id}. A pin naming a row that does not exist ` +
      "passes on nothing, which is the shape of guard this project keeps " +
      "finding",
  );
}

/**
 * Whether the app asks the landmarker for blendshapes.
 *
 * Read from the source the card is already held to, rather than from a
 * second copy of the fact. Row 12.2 turns them on; until then anything
 * wanting `jawOpen` cannot be started.
 */
export function blendshapesEnabled(root) {
  const source = readFileSync(join(root, LANDMARKER), "utf8");
  return landmarkerOptions(source).outputFaceBlendshapes;
}

// The sentence the ladder ends an amendment with, naming the rows that
// can still be picked up. Amendment 19.
//
// Amendment 18 wrote one and it was wrong twice inside a day: once
// about a row whose Check waits on a corpus rule, corrected inside the
// amendment itself, and again when three of the four it left standing
// turned out to have a clause this container cannot meet. Both times
// the mistake was the same: startable was judged from the row's
// headline instead of from every clause of its Check.
//
// The judgement stays a person's. What is mechanical is that the
// sentence cannot go quietly out of date: a row it names must be open
// and unmarked, and the moment one of them is ticked or blocked the
// build says so.
const STARTABLE =
  /Rows? ([\d.a-z]+(?:,\s*[\d.a-z]+)*(?:,?\s*and\s+[\d.a-z]+)?) remains? startable and (?:are|is) not marked/g;

/**
 * The rows the ladder claims can still be started.
 *
 * Throws when the ladder makes no such claim. Not an empty list: a
 * ladder saying nothing about where work can begin is the state
 * amendment 18 was written to end, and a guard reporting "nothing
 * claimed" would make this satisfiable with a delete, which is the
 * shape of guard this repository keeps finding.
 */
export function startableClaims(roadmapText) {
  const found = [...roadmapText.matchAll(STARTABLE)].flatMap((match) =>
    match[1]
      .split(/,\s*|\s+and\s+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
  if (found.length === 0) {
    throw new Error(
      "ROADMAP.md: no sentence naming which rows remain startable. The " +
        'form is "Rows <a>, <b> and <c> remain startable and are not ' +
        'marked", and it is held to the rows themselves, so deleting it ' +
        "is not a way to make it true",
    );
  }
  return found;
}

/**
 * The claimed-startable rows the ladder has since overtaken, with why.
 *
 * Two ways to go stale and they cost the same. A row that has picked
 * up a blocked marker is not startable, and a row that is ticked has
 * nothing left to start: both send the next reader to a row with no
 * work in it, which is the whole expense amendment 18 exists to stop.
 *
 * A claim naming a row that is not in the ladder throws, through
 * `roadmapRow`, because a sentence about a row that does not exist
 * passes on nothing.
 */
export function staleStartables(roadmapText) {
  const stale = [];
  for (const id of startableClaims(roadmapText)) {
    const line = roadmapRow(roadmapText, id);
    const box = line.match(ROW);
    if (box !== null && box[1] !== " ") {
      stale.push({ id, why: "is already ticked" });
      continue;
    }
    if (BLOCKED.test(line)) {
      stale.push({ id, why: "carries a BLOCKED marker" });
    }
  }
  return stale;
}

// Roadmap 10.0b8, from amendment 20. The guard above holds a
// claimed-startable row to its own LINE: the row is open, the row is
// unmarked. A row can pass both while the header of its PHASE forbids
// it from beginning at all, and three rows did exactly that on the day
// that guard shipped.
//
// The Check is what a row must prove. The gate is whether it may
// begin. Reading one has never told anybody the other, which is why
// judging startable clause by clause — the fix amendment 19 was proud
// of — still named three rows that could not start.
//
// The gate is prose, so this reads prose, and it is written to fail
// loudly wherever it cannot: a gate parsed to an empty list is a gate
// that permits everything, and it looks exactly like a gate that
// permits nothing to be wrong.

// Both patterns allow a dot inside the capture, which is the whole
// difficulty: every row number has one, so a "not a dot" class stops
// at "10." and reads no gate at all — which is the failure mode this
// row exists to prevent, arriving inside the fix for it. The lists
// terminate on their sentence instead: "are ticked" for one, and a
// period followed by whitespace for the other, which "12.0a-b" and
// "12.17's tool" cannot fake. Both spans wrap across lines, so both
// patterns are dot-all.
const GATE =
  /GATE[^:]*:\s*no signal row here starts before ([\s\S]+?)\s+are\s+ticked/;
const EXEMPT = /The instrument rows are exempt[^:]*:\s*([\s\S]+?)\.(?:\s|$)/;

/**
 * The ladder split at its phase headings.
 *
 * Split on a regex rather than on the literal "\n## Phase " because a
 * document can begin with one, and a reader that quietly saw no
 * phases would report no gates, which reads exactly like a ladder
 * with nothing to enforce.
 */
function phaseSections(roadmapText) {
  return roadmapText.split(/(?:^|\n)## Phase /).slice(1);
}

/**
 * The rows one item of a gate's prose names.
 *
 * The ladder writes runs as `10.12a-c`, so an item is either a row or
 * a lettered range of them. Anything else THROWS. The alternative is
 * to skip what cannot be read, and a gate that skips is a gate with
 * holes exactly where somebody wrote something unusual, which is
 * where the interesting rows live.
 */
export function expandRowRange(item) {
  const plain = item.match(/^(\d+(?:\.\d+)*[a-z]?\d*)$/);
  if (plain !== null) {
    return [plain[1]];
  }
  const range = item.match(/^(\d+(?:\.\d+)*)([a-z])-([a-z])$/);
  if (range !== null) {
    const [, base, from, to] = range;
    const start = from.charCodeAt(0);
    const end = to.charCodeAt(0);
    if (end >= start) {
      const rows = [];
      for (let code = start; code <= end; code += 1) {
        rows.push(`${base}${String.fromCharCode(code)}`);
      }
      return rows;
    }
  }
  throw new Error(
    `ROADMAP.md: a gate names "${item}", which this reader cannot read as ` +
      "a row or a lettered range. A gate parsed to nothing is a gate that " +
      "permits everything, so it refuses rather than skipping",
  );
}

/** Split a prose list — "a, b and c" — into its items. */
function listItems(text) {
  return text
    .split(/,\s*|\s+and\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Every phase whose header carries a gate, with what it waits on and
 * what it lets through.
 *
 * `exemptOther` holds the items of the exemption list that are not
 * whole rows — Phase 12 exempts "12.17's tool", which is a tool and
 * not the row, so reading it as row 12.17 would open the gate for a
 * row nobody exempted. Reported rather than dropped, so a test can
 * pin what the ladder is getting away with.
 */
export function phaseGates(roadmapText) {
  const gates = [];
  for (const section of phaseSections(roadmapText)) {
    const phase = (section.split("\n")[0] ?? "").trim();
    const header = section.split("\n- [")[0] ?? "";
    const gate = header.match(GATE);
    if (gate === null) {
      continue;
    }
    const prerequisites = listItems(gate[1]).flatMap(expandRowRange);
    const exempt = header.match(EXEMPT);
    const exemptRows = [];
    const exemptOther = [];
    for (const item of exempt === null ? [] : listItems(exempt[1])) {
      try {
        exemptRows.push(...expandRowRange(item));
      } catch {
        exemptOther.push(item);
      }
    }
    gates.push({ phase, prerequisites, exemptRows, exemptOther });
  }
  return gates;
}

/** Which phase a row sits under, by its number, or null. */
function phaseOf(roadmapText, id) {
  for (const section of phaseSections(roadmapText)) {
    for (const line of section.split("\n")) {
      const row = line.match(ROW);
      if (row !== null && row[2] === id) {
        return (section.split("\n")[0] ?? "").trim();
      }
    }
  }
  return null;
}

/** Whether a row is ticked in the ladder. */
function ticked(roadmapText, id) {
  const box = roadmapRow(roadmapText, id).match(ROW);
  return box !== null && box[1] !== " ";
}

/**
 * The claimed-startable rows whose phase will not let them start,
 * each with the prerequisite that is missing.
 *
 * A row is let through when its phase carries no gate, when the
 * header exempts it by name, or when every row the gate names is
 * ticked. Otherwise the FIRST unticked prerequisite is reported,
 * because naming one thing to go and do is more use than naming
 * seven.
 */
export function gatedStartables(roadmapText) {
  const gates = phaseGates(roadmapText);
  const blocked = [];
  for (const id of startableClaims(roadmapText)) {
    const phase = phaseOf(roadmapText, id);
    const gate = gates.find((one) => one.phase === phase);
    if (gate === undefined || gate.exemptRows.includes(id)) {
      continue;
    }
    const waiting = gate.prerequisites.find(
      (need) => !ticked(roadmapText, need),
    );
    if (waiting !== undefined) {
      blocked.push({ id, why: `its phase gate waits on ${waiting}` });
    }
  }
  return blocked;
}
