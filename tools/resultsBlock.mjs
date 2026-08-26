import { readRepoFile, parseResultFile } from "./resultGuard.mjs";

// Roadmap 7.9: the README's results section, generated from the
// committed result files instead of written beside them. The guard
// next door (resultGuard.mjs) already fails the build when prose
// disagrees with docs/eyeblink8-result.txt; this goes one step
// further for the summary block: the prose IS the parse, so there is
// nothing left to disagree. A test regenerates the block and fails
// when the committed README drifts from it, and the same test is the
// roadmap row's other check: no TODO may remain inside the block.
//
// Same arrangement as bundleGuard, exportGuard and resultGuard:
// plain .mjs that reads the disk, hand-written types next door,
// callers type checked.

export const BEGIN_MARKER = "<!-- results:begin -->";
export const END_MARKER = "<!-- results:end -->";

/**
 * The DROZY result's summary facts, parsed from docs/drozy-result.txt.
 * Throws rather than returning a partial object: a result file this
 * cannot parse is a finding, not something to skip past.
 */
export function parseDrozyResult(text) {
  const grab = (pattern, what) => {
    const match = text.match(pattern);
    if (match === null) {
      throw new Error(`drozy result file: could not find ${what}`);
    }
    return match;
  };
  const measured = grab(
    /^\s*sessions measured\s+(\d+)\s*$/m,
    "the sessions-measured line",
  );
  const analysed = grab(/^\s*analysed\s+(\d+)\s*$/m, "the analysed line");
  // The verdict sentence, verbatim. If the result ever stops being a
  // null, this line disappears from the file and the build goes red
  // here instead of the README quietly still calling it a null.
  grab(/Nothing cleared both bars\./, "the null-verdict sentence");
  // DROZY's written permission requires the citation wherever results
  // appear, in any form, so the block cannot be built without it.
  const cite = grab(/^Cite:\s*(.+)$/m, "the citation line");
  return {
    measured: Number(measured[1]),
    analysed: Number(analysed[1]),
    cite: (cite[1] ?? "").trim(),
  };
}

/**
 * The three pre-registered criteria verdicts, parsed from the round's
 * published table in docs/validation-round.txt. Each criterion's
 * paragraph is searched for its verdict token, worst first, so
 * "NOT EVALUATED" cannot be shadowed by a "not met" later in the
 * same paragraph.
 */
export function parseRoundVerdicts(text) {
  // A criterion's text runs to the NEXT criterion's opener or the
  // next blank line, whichever comes first: the published table
  // prints the three on consecutive lines with no blank between
  // them, so a blank-line rule alone would hand criterion 1 the
  // verdicts of all three.
  const paragraph = (opener, nextOpener) => {
    const start = text.indexOf(opener);
    if (start === -1) {
      throw new Error(`round write-up: could not find "${opener}"`);
    }
    const stops = [
      nextOpener === null ? -1 : text.indexOf(`\n${nextOpener}`, start),
      text.indexOf("\n\n", start),
    ].filter((stop) => stop !== -1);
    const end = stops.length === 0 ? text.length : Math.min(...stops);
    return text.slice(start, end);
  };
  const verdictIn = (body, name) => {
    for (const token of ["NOT EVALUATED", "FAILED", "not met"]) {
      if (body.includes(token)) {
        return token;
      }
    }
    throw new Error(`round write-up: no verdict in the ${name} criterion`);
  };
  return {
    detector: verdictIn(
      paragraph(
        "1. The detector does not generalise",
        "2. The baseline does not generalise",
      ),
      "detector",
    ),
    baseline: verdictIn(
      paragraph(
        "2. The baseline does not generalise",
        "3. The frame rate gate lets bad sessions through",
      ),
      "baseline",
    ),
    gate: verdictIn(
      paragraph("3. The frame rate gate lets bad sessions through", null),
      "gate",
    ),
  };
}

/** The whole generated block, markers included. */
/**
 * The second machine's numbers, parsed from the same result file.
 *
 * Written 25 August 2026, when the corpus was re-measured on
 * different hardware and precision moved 12.4 points on identical
 * frames. The summary block cannot hand-write those numbers for the
 * same reason it cannot hand-write the first machine's: prose beside
 * a number drifts from it, and the whole point of this generator is
 * that the prose IS the parse. Throws rather than skipping, so a
 * result file that stops carrying the pair is a red build instead of
 * a README that quietly goes back to claiming one table.
 */
export function parseSecondMachine(text) {
  const grab = (pattern, what) => {
    const match = text.match(pattern);
    if (match === null) {
      throw new Error(`result file: could not find ${what}`);
    }
    return match;
  };
  const recall = grab(
    /Recall\s+[\d.]+% \(\d+\/\d+\)\s+([\d.]+)% \((\d+)\/(\d+)\)/,
    "the second machine's recall line",
  );
  const precision = grab(
    /Precision\s+[\d.]+% \(\d+ made\)\s+([\d.]+)% \((\d+) made\)/,
    "the second machine's precision line",
  );
  const f1 = grab(/F1\s+[\d.]+%\s+([\d.]+)%/, "the second machine's F1 line");
  const recallSpread = grab(
    /recall\s+[\d.]+% vs [\d.]+%,\s+([\d.]+) points apart/,
    "the recall spread",
  );
  const precisionSpread = grab(
    /precision\s+[\d.]+% vs [\d.]+%,\s+([\d.]+) points apart/,
    "the precision spread",
  );
  return {
    recallPercent: recall[1],
    found: Number(recall[2]),
    annotated: Number(recall[3]),
    precisionPercent: precision[1],
    invented: Number(precision[2]),
    f1Percent: f1[1],
    recallSpread: recallSpread[1],
    precisionSpread: precisionSpread[1],
  };
}

export function buildResultsBlock(root) {
  const run = parseResultFile(readRepoFile("docs/eyeblink8-result.txt", root));
  const drozy = parseDrozyResult(readRepoFile("docs/drozy-result.txt", root));
  const second = parseSecondMachine(
    readRepoFile("docs/eyeblink8-result.txt", root),
  );
  const round = parseRoundVerdicts(
    readRepoFile("docs/validation-round.txt", root),
  );
  const lines = [
    BEGIN_MARKER,
    "<!-- Generated from the committed result files by",
    "tools/resultsBlock.mjs. Edit those files, then regenerate with:",
    "npm run results:write. A test regenerates this block and fails",
    "when the committed README drifts from it. -->",
    "",
    "## Results at a glance",
    "",
    `- **Does it find the blinks a human found?** On Eyeblink8, recall ${run.recallPercent}% (${String(run.found)} of ${String(run.annotated)} found), precision ${run.precisionPercent}% (${String(run.invented)} invented), F1 ${run.f1Percent}%, measured from \`${run.reproDir}\`. **That table is a property of the machine it was measured on.** Re-measured on a second machine — same code, same committed model, same pinned runtime, identical frames — the corpus gives recall ${second.recallPercent}% (${String(second.found)} of ${String(second.annotated)}), precision ${second.precisionPercent}% (${String(second.invented)} invented), F1 ${second.f1Percent}%. The cause of that gap is now measured, and it was the FILES, not the machine: the second run's clips had been re-encoded instead of remuxed by the committed preparation tool, and re-encoding alone collapses false alarms (19 to 3 on the worst clip, at every quality from lossless to visibly lossy). Handed the correctly prepared files, the second machine reproduces the published counts digit for digit on the clip measured so far. The second table stays published as a real measurement of wrongly prepared files; it is not an Eyeblink8 result. Full record: [docs/eyeblink8-result.txt](docs/eyeblink8-result.txt).`,
    `- **Does any of it track reported sleepiness?** No. A null result, published as readily as a positive one would have been: nothing cleared the pre-registered bar on the ${String(drozy.analysed)} of ${String(drozy.measured)} DROZY sessions this instrument can measure. Full record: [docs/drozy-result.txt](docs/drozy-result.txt). Cite: ${drozy.cite}`,
    `- **Does it work on other people?** Six volunteers, three pre-registered failure criteria: the detector's criterion ${round.detector}, the baseline's criterion ${round.baseline}, the frame-rate gate's criterion ${round.gate}. Full record: [docs/validation-round.txt](docs/validation-round.txt).`,
    "- **Limitations, stated plainly:** how many blinks it finds depends on how fast the viewer's computer is; the learned baseline was unusable on three of the six volunteer machines; the DROZY sample is missing its sleepiest sessions, so its null is weaker than a null on the full set; and the alertness score has never been shown to correspond to anyone's actual sleepiness.",
    "",
    END_MARKER,
  ];
  return lines.join("\n");
}

/**
 * README text with its marked block replaced by a fresh one. Throws
 * when the markers are missing or doubled: a splice that guesses
 * where the block lives would be this project's recurring defect
 * with a text editor.
 */
export function spliceResultsBlock(readmeText, block) {
  const begin = readmeText.indexOf(BEGIN_MARKER);
  const end = readmeText.indexOf(END_MARKER);
  if (begin === -1 || end === -1) {
    throw new Error("README has no results markers to splice between");
  }
  if (
    readmeText.indexOf(BEGIN_MARKER, begin + 1) !== -1 ||
    readmeText.indexOf(END_MARKER, end + 1) !== -1
  ) {
    throw new Error("README has more than one results block");
  }
  if (end < begin) {
    throw new Error("README's results markers are in the wrong order");
  }
  return (
    readmeText.slice(0, begin) +
    block +
    readmeText.slice(end + END_MARKER.length)
  );
}

/** The committed block as it stands in the README, markers included. */
export function committedResultsBlock(readmeText) {
  const begin = readmeText.indexOf(BEGIN_MARKER);
  const end = readmeText.indexOf(END_MARKER);
  if (begin === -1 || end === -1) {
    throw new Error("README has no results block");
  }
  return readmeText.slice(begin, end + END_MARKER.length);
}
