// Roadmap 10.0b4, ladder B17. CHANGELOG.md was never joined to the
// guarded documents, and it published a headline.
//
// Its Unreleased section had said "87.7% recall, 83.3% precision,
// 85.4% F1" since 15 August 2026. That is the THIRD of the five
// figures this project has published for Eyeblink8, superseded twice
// since, and nothing in the file said so. README keeps all five in a
// table on purpose and marks which is current; the result file keeps
// the superseded runs below a boundary line for the same reason. The
// changelog did neither: it stated one figure, in the present tense,
// in the section that describes what is about to ship.
//
// Same arrangement as the other guards: plain .mjs reading the disk,
// data out, callers type checked.

/**
 * The Unreleased section's text, up to the first released version.
 *
 * Refuses a file without one. An empty section would read as "nothing
 * is claimed here", which is also what a renamed heading looks like,
 * and a guard that cannot tell those apart passes on both.
 */
export function unreleasedSection(changelogText) {
  const match = changelogText.match(/## Unreleased\n([\s\S]*?)(?=\n## |$)/);
  if (match === null) {
    throw new Error(
      "CHANGELOG.md: no Unreleased section. Reporting an empty one would " +
        "read as a changelog claiming nothing, which is what a renamed " +
        "heading also looks like",
    );
  }
  return match[1];
}

/**
 * The Eyeblink8 headline a section states, or null when it states
 * none.
 *
 * All three or none. A sentence that gives recall and precision and
 * drops F1 is a sentence somebody edited, and reporting two thirds of
 * a headline would leave the third drifting with nothing watching it.
 * Prose here hard-wraps, so the parts may sit on either side of a line
 * break.
 */
export function statedEyeblink8(sectionText) {
  const recall = sectionText.match(/([\d.]+)%\s+recall/);
  const precision = sectionText.match(/([\d.]+)%\s+precision/);
  const f1 = sectionText.match(/([\d.]+)%\s+F1/);
  if (recall === null && precision === null && f1 === null) {
    return null;
  }
  const missing = [
    recall === null ? "recall" : null,
    precision === null ? "precision" : null,
    f1 === null ? "F1" : null,
  ].filter((name) => name !== null);
  if (missing.length > 0) {
    throw new Error(
      `CHANGELOG.md: an Eyeblink8 headline missing its ${missing.join(" and ")}. ` +
        "A headline is all three or none, because a part nobody states is " +
        "a part nobody checks",
    );
  }
  return { recall: recall[1], precision: precision[1], f1: f1[1] };
}
