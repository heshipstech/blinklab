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

/**
 * Every string literal assigned as a button's label in main.ts, in
 * source order, once each.
 *
 * Roadmap 14.0b: the box check held docs/UI.md to the page's headings
 * and nothing else, and three button labels had drifted out of the
 * document unnoticed. The pattern reads `xButton.textContent = "..."`
 * and `button.textContent = "..."`, which is how every button on the
 * page gets its words; a template literal is not a label and is left
 * alone.
 */
export function buttonStrings(mainSource) {
  const found = [
    ...mainSource.matchAll(/\b\w*[bB]utton\.textContent = "([^"]+)"/g),
  ].map((m) => m[1]);
  return [...new Set(found)];
}

/**
 * The idle table out of src/core/idleStrings.ts, each entry joined the
 * way the page shows it: `Label: value`.
 *
 * Read from the core file as text rather than imported, so this guard
 * stays a plain script with no build step between it and the disk.
 */
export function idleStrings(idleSource) {
  return [...idleSource.matchAll(/^\s*\["([^"]+)", "([^"]+)"\],?$/gm)].map(
    (m) => `${m[1]}: ${m[2]}`,
  );
}

/** The strings among `strings` that `doc` never mentions verbatim. */
export function undocumentedStrings(strings, doc) {
  return strings.filter((text) => !doc.includes(text));
}

/**
 * Every `dataset.testid` in main.ts that names a screen the page
 * raises over itself: a handle ending in `-overlay` or `-dialog`.
 *
 * Roadmap 14.0f1. `src/core/overlayEscape.ts` holds the rule for which
 * of these Escape may close, and a screen missing from that register
 * is a screen a keyboard cannot leave — a failure nobody testing with
 * a mouse will ever meet. So the register is held to the page in both
 * directions by the test next door, and this is the half that reads
 * the page.
 *
 * The suffix rather than a hand-kept list, for the reason 10.0b7
 * learned the hard way: a guard that consults a list somebody
 * maintains is a guard that goes stale the first time somebody forgets.
 * A new screen has to be given a handle to be testable at all, and the
 * moment it has one this sees it.
 */
export function overlayHandles(mainSource) {
  return [
    ...mainSource.matchAll(
      /\.dataset\.testid = "([a-z0-9-]*-(?:overlay|dialog))"/g,
    ),
  ].map((m) => m[1]);
}

/**
 * Every identifier assigned `.hidden` in a source file, in source
 * order, once each.
 *
 * Roadmap 14.0f1, and the failure it prevents is silent and total.
 * Setting `hidden` on an OPEN native modal gives it display:none and
 * leaves it open: the dialog vanishes, the page behind it stays inert,
 * and there is nothing on screen to answer. Probed in Chromium before
 * the row was written, because the sleepiness question's five reset
 * paths all spelled it exactly that way while it was a div.
 *
 * A reader rather than a rule, so the test next door names the one
 * element this must never find and the guard stays about what the file
 * says.
 */
export function hiddenAssignments(source) {
  const found = [...source.matchAll(/\b(\w+)\.hidden = /g)].map((m) => m[1]);
  return [...new Set(found)];
}
