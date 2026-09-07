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
