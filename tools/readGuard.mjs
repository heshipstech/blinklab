import { createHash } from "node:crypto";

import { readRepoFile } from "./resultGuard.mjs";

// Roadmap 10.0b6, ladder B14's stamp half.
//
// This repository already stamps three documents with the date they
// were WRITTEN or REVISED, and a test turns the build red when a
// stamped file changes without its stamp moving. That catches a
// document being edited and left dated wrongly.
//
// It does not catch what the September audit actually found: five
// sentences that were each true when written and false by the time
// they were read, sitting in documents that had been edited many
// times since. Every one of those edits bumped the revised stamp. The
// missing act is not editing. It is READING the whole thing and
// confirming it still holds.
//
// So this stamp is held to the document's CLAIM TEXT rather than its
// bytes: the prose with its generated blocks and its count figures
// normalised away. A number the machine updated is not something a
// human read would have caught, and a gate that fires on every count
// bump is a rubber stamp inside a week. A changed sentence is a
// different thing, and that is what goes stale here.
//
// The documents are the ones a reader treats as a CURRENT DESCRIPTION
// of the system. STATE.md and LEARNING.md are deliberately absent:
// they are append-only logs, an old entry does not become false when
// a new one lands, and demanding a full re-read on every append would
// make the stamp a formality.

export const READ_IN_FULL_DOCS = [
  "README.md",
  "MODEL_CARD.md",
  "PROJECT.md",
  "ARCHITECTURE.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STAMP =
  /Read in full on (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})(?:[^.\n]*?claims `?([0-9a-f]{8})`?)?/;

/**
 * The document reduced to the claims a reader would check.
 *
 * Generated blocks go, markers and all, because their contents are
 * held byte for byte by their own tests and a person re-reading them
 * would be checking a machine's arithmetic. Count figures are
 * normalised because the same is true of them. The stamp line itself
 * goes, so recording a read is not a change that immediately
 * invalidates the record of it.
 */
export function claimText(docText) {
  return (
    docText
      .replace(/<!-- \w+:begin -->[\s\S]*?<!-- \w+:end -->\n?/g, "")
      .replace(/^.*Read in full on .*$\n?/gm, "")
      // The revised stamp goes too. It is bookkeeping held by its own
      // guard, and coupling the two would make every revised-date bump
      // demand a fresh read of a document nothing had changed in.
      .replace(
        /(?:Written|[Rr]evised|Stamped:)\s*\d{1,2} \w+ \d{4}/g,
        "STAMP DATE",
      )
      .replace(
        /\b\d[\d,]*\s+(unit tests|end to end tests|Python tests|tests)\b/g,
        "N $1",
      )
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
      .join("\n")
      .trim()
  );
}

/** A short digest of a document's claims, for the stamp to carry. */
export function claimDigest(docText) {
  return createHash("sha256")
    .update(claimText(docText))
    .digest("hex")
    .slice(0, 8);
}

/**
 * The read-in-full stamp a document carries, or null when it carries
 * none.
 *
 * A date with no digest throws rather than being reported. A stamp
 * nobody can check against anything is a document saying it was read
 * and never going stale, which is worse than no stamp at all.
 */
export function readInFullStamp(docText) {
  const match = docText.match(STAMP);
  if (match === null) {
    return null;
  }
  if (match[4] === undefined) {
    throw new Error(
      "a read-in-full stamp with no claims digest: it could never go " +
        "stale, so it would record a read that nothing checks",
    );
  }
  const month = String(MONTHS.indexOf(match[2]) + 1).padStart(2, "0");
  return {
    date: `${match[3]}-${month}-${match[1].padStart(2, "0")}`,
    digest: match[4],
  };
}

/**
 * The named documents whose claims have changed since their last full
 * read, each with the digest stamped and the digest now.
 */
export function staleReads(root) {
  const stale = [];
  for (const name of READ_IN_FULL_DOCS) {
    const text = readRepoFile(name, root);
    const stamp = readInFullStamp(text);
    if (stamp === null) continue;
    const now = claimDigest(text);
    if (now !== stamp.digest) {
      stale.push({ name, stamped: stamp.digest, now, date: stamp.date });
    }
  }
  return stale;
}
