// Remediation F3. docs/UI.md claims to list every element the page can
// show, and it is the compensating control for the src/ui folder that
// SPEC.md describes and that has never existed. It had one commit and
// fifteen main.ts commits behind it, and nothing could fail when the
// two disagreed.
//
// So they disagreed. By 15 August the file described five boxes in
// three tiers when there were eight in four rows, put Session in a
// tier of its own when it sits under Alertness, and documented an
// "Instrument" box that had become the footer of Live signals. Every
// one of those was written correctly once and the page moved
// underneath it, which is the same shape as the prose defects the
// result guard was built for.
//
// This reads the box headings out of src/main.ts and holds docs/UI.md
// to them in BOTH directions: a box with no section is an undocumented
// box, and a section naming a box that no longer exists is a fossil.
// Neither can be argued with, because both sides are read from disk.
//
// Same arrangement as bundleGuard, exportGuard, claimGuard,
// resultGuard and drozyGuard: plain .mjs that reads the disk,
// hand-written types next door, callers type checked.

/**
 * Every heading passed to the box() helper in main.ts, in source
 * order.
 *
 * box() is called two ways, `box("Alertness", ...)` on one line and
 * `box(\n  "Source",\n ...)` across several, so the pattern allows
 * whitespace and a newline between the paren and the string rather
 * than assuming either style. A guard that silently matched only the
 * one-line form would have found five of the eight boxes and reported
 * success, which is the failure mode this repository keeps meeting.
 */
export function boxHeadings(mainSource) {
  return [...mainSource.matchAll(/\bbox\(\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** Every box name documented by a `#### Box: X` or `### 5.N Box: X` heading. */
export function documentedBoxes(uiDoc) {
  return [...uiDoc.matchAll(/^#{3,4} (?:\d+\.\d+ )?Box: (.+)$/gm)].map((m) =>
    (m[1] ?? "").trim(),
  );
}

/** Box headings in the code with no section in the document. */
export function undocumented(mainSource, uiDoc) {
  const documented = new Set(documentedBoxes(uiDoc));
  return boxHeadings(mainSource).filter((name) => !documented.has(name));
}

/** Boxes the document describes that the code no longer builds. */
export function fossils(mainSource, uiDoc) {
  const real = new Set(boxHeadings(mainSource));
  return documentedBoxes(uiDoc).filter((name) => !real.has(name));
}
