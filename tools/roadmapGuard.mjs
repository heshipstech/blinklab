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
