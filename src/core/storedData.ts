// What this page keeps on the visitor's own device, as data rather
// than as prose scattered through the interface.
//
// Remediation E3 asked two things: enumerate what is stored, and give
// the person a way to erase it. An enumeration that only exists in a
// paragraph drifts from the code the moment a key is added, so the
// list lives here, in one tested place, and both the interface and
// docs/UI.md render it. Same arrangement as notice.ts.
//
// This module is pure. It never touches localStorage; it is handed
// the result of a probe and turns it into sentences. That split is
// what lets the awkward cases below be tested at all, because a
// browser that refuses to answer cannot be staged in a unit test.

export type StoredItem = {
  /** The localStorage key, shown so a curious reader can go and look. */
  key: string;
  /** What it holds, in the visitor's language rather than the code's. */
  what: string;
  /** Why the page keeps it, because storage without a reason is a smell. */
  why: string;
};

export const STORED_ITEMS: readonly StoredItem[] = [
  {
    key: "blinklab-calibration-profile-v1",
    what: "Your gaze calibration profile",
    why: "so a calibration survives a reload and works from the first frame of your next visit",
  },
  {
    key: "blinklab-calibration-samples-v1",
    what: "The measurements that profile was solved from",
    why: "so the profile can be re-solved without sitting through the nine dots again",
  },
  // The guided blink calibration (core/guidedCalibration.ts): a
  // personal blink line measured from this person's own open and
  // closed aperture, written only when a run resolves to a line. It is
  // listed here the moment the store can write it, so the erase control
  // and this enumeration never fall out of step with the key.
  {
    key: "blinklab-blink-calibration-v1",
    what: "Your personal blink line",
    why: "so a guided blink calibration survives a reload and does not have to be repeated on your next visit",
  },
  // The pilot's voluntary identity (docs/assessment-pilot-plan.md,
  // increment 8): created only when a person types one and saves it,
  // never invented on load — the deviceId refusal's principle. It
  // enters the export as a row only when it exists.
  {
    key: "blinklab-participant-pseudonym-v1",
    what: "Your chosen pseudonym",
    why: "so your exported files can carry a name you picked, and only if you picked one",
  },
];

/**
 * The longest pseudonym the page will save. Not a benchmark-derived
 * number: a pseudonym is one metadata line a human reads, so anything
 * longer is almost certainly a paste error, and it is REFUSED with
 * its reason rather than truncated — a silent truncation would export
 * a name the person never chose.
 */
export const PSEUDONYM_MAX_CHARS = 64;

export type PseudonymDecision =
  | { kind: "ok"; value: string }
  | { kind: "none" }
  | { kind: "tooLong"; limit: number };

/**
 * One trimmed line, or the reason there is none. Whitespace collapses
 * because a newline would break the export's one-line metadata row;
 * an empty save is an explicit removal, not a pseudonym of nothing.
 */
export function normalizePseudonym(raw: string): PseudonymDecision {
  const value = raw.replace(/\s+/g, " ").trim();
  if (value === "") {
    return { kind: "none" };
  }
  if (value.length > PSEUDONYM_MAX_CHARS) {
    return { kind: "tooLong", limit: PSEUDONYM_MAX_CHARS };
  }
  return { kind: "ok", value };
}

/**
 * The result of asking the browser what it is holding.
 *
 * `unreadable` is not the same as absent and must never be folded into
 * it. Safari's lockdown mode and blocked-storage settings make
 * localStorage THROW on read, and a page that reported that as
 * "nothing stored" would be claiming a clean device it never managed
 * to inspect. That is this project's recurring defect, silent success,
 * and it is exactly the wrong place for it: the one sentence a privacy
 * control must never get wrong is "there is nothing here".
 */
export type StorageProbe = {
  present: readonly string[];
  unreadable: readonly string[];
};

const KNOWN_KEYS = new Set(STORED_ITEMS.map((item) => item.key));

/** Only keys this module actually documents, so a stray key cannot inflate a count. */
function known(keys: readonly string[]): string[] {
  return keys.filter((key) => KNOWN_KEYS.has(key));
}

/**
 * What one listed item's line says about itself. Roadmap 14.0b (audit
 * E4): the box said "Nothing is stored on this device." above a list
 * of four keys, and a reader took the list for an inventory.
 */
export function storedItemState(
  item: StoredItem,
  probe: StorageProbe,
): "stored now" | "not stored" | "cannot be read" {
  if (probe.unreadable.includes(item.key)) {
    return "cannot be read";
  }
  return probe.present.includes(item.key) ? "stored now" : "not stored";
}

/** Whether the probe found anything worth offering to erase. */
export function hasSomethingToErase(probe: StorageProbe): boolean {
  return known(probe.present).length > 0;
}

/**
 * The erase button's own words, here rather than inline in the page,
 * because the disabled cases are claims about the device and one of
 * them was wrong when this was first written: a browser refusing to be
 * read produced a disabled button reading "nothing stored", directly
 * contradicting the summary line above it. Two disabled states exist
 * and they mean opposite things, so they say different sentences.
 */
export function eraseButtonLabel(probe: StorageProbe, armed: boolean): string {
  if (known(probe.unreadable).length > 0) {
    return "Erase stored data (this browser will not let the page look)";
  }
  if (!hasSomethingToErase(probe)) {
    return "Erase stored data (nothing stored)";
  }
  return armed ? "Click again to erase it" : "Erase stored data";
}

/** One line describing what is on this device right now. */
export function storedSummary(probe: StorageProbe): string {
  if (known(probe.unreadable).length > 0) {
    return "This browser will not let the page read its own storage, so what is stored here cannot be listed or erased from this page.";
  }
  const count = known(probe.present).length;
  if (count === 0) {
    return "Nothing is stored on this device.";
  }
  return `Stored on this device now: ${count} of ${STORED_ITEMS.length}.`;
}

/**
 * What to say after an erase was attempted, given a FRESH probe taken
 * after it. The message is derived from what the browser still holds,
 * never from whether the remove call threw, because a remove that
 * returns quietly and changes nothing is the failure worth catching.
 */
export function eraseOutcomeMessage(probe: StorageProbe): string {
  if (known(probe.unreadable).length > 0) {
    return "Tried to erase, but this browser will not let the page read its storage, so the result cannot be confirmed here.";
  }
  const remaining = known(probe.present).length;
  if (remaining === 0) {
    return "Erased. Nothing is stored on this device now.";
  }
  return `Erase did not work: ${remaining} of ${STORED_ITEMS.length} ${remaining === 1 ? "item is" : "items are"} still stored.`;
}
