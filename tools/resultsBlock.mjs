import {
  parseAlertnessResult,
  parseResultFile,
  readRepoFile,
} from "./resultGuard.mjs";

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
 * The UTA-RLDD result's summary facts, parsed from
 * docs/uta-rldd-result.txt. Same contract as parseDrozyResult: throws
 * on a file it cannot read, and grabs the detection verdict so that if
 * the result ever stops being a detection the build goes red here
 * instead of the README quietly still claiming one -- the mirror of
 * the DROZY null-verdict guard next door.
 */
export function parseUtaResult(text) {
  const grab = (pattern, what) => {
    const match = text.match(pattern);
    if (match === null) {
      throw new Error(`uta-rldd result file: could not find ${what}`);
    }
    return match;
  };
  const subjects = grab(
    /^\s*subjects\s+(\d+)\s+\(of \d+;/m,
    "the usable-subjects line",
  );
  const analysed = grab(/^\s*analysed\s+(\d+)\s*$/m, "the analysed line");
  // Two "balanced accuracy ... majority floor" lines live in the file;
  // the 1/3 floor names the three-class one and 1/2 the binary, so each
  // is anchored on its own floor rather than on match order.
  const threeClass = grab(
    /balanced accuracy\s+([\d.]+)\s+majority floor 1\/3 = ([\d.]+)/,
    "the three-class accuracy and floor",
  );
  const binary = grab(
    /balanced accuracy\s+([\d.]+)\s+majority floor 1\/2 = ([\d.]+)/,
    "the alert-vs-drowsy accuracy and floor",
  );
  // The three-class negative control's p, on its own line; the binary p
  // shares a line with prose and is deliberately not the one caught.
  const p = grab(/^\s*permutation p\s+([\d.]+)\s*$/m, "the permutation p line");
  // If the result ever stops being a detection, these verdict lines
  // change and the build goes red here instead of the README quietly
  // still calling it a detection.
  grab(/three-class\s+detecting drowsiness/, "the three-class verdict");
  grab(/alert vs drowsy\s+detecting drowsiness/, "the alert-vs-drowsy verdict");
  // UTA-RLDD's safeguards require the CVPR Workshops 2019 citation
  // wherever results appear; it spans two lines in the file.
  const cite = grab(
    /^Cite:\s*([\s\S]+?CVPR Workshops 2019\.)/m,
    "the citation line",
  );
  return {
    subjects: Number(subjects[1]),
    analysed: Number(analysed[1]),
    threeClass: threeClass[1],
    threeFloor: threeClass[2],
    binary: binary[1],
    binaryFloor: binary[2],
    p: String(Number(p[1])),
    cite: (cite[1] ?? "").replace(/\s+/g, " ").trim(),
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
  const uta = parseUtaResult(readRepoFile("docs/uta-rldd-result.txt", root));
  const second = parseSecondMachine(
    readRepoFile("docs/eyeblink8-result.txt", root),
  );
  const round = parseRoundVerdicts(
    readRepoFile("docs/validation-round.txt", root),
  );
  // Roadmap 10.0a3, ladder B5: the limitations bullet used to type its
  // numbers, so it was a hand-maintained sentence inside a generator.
  const alertness = parseAlertnessResult(
    readRepoFile("docs/alertness-score-result.txt", root),
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
    `- **Does it find the blinks a human found?** On Eyeblink8, recall ${run.recallPercent}% (${String(run.found)} of ${String(run.annotated)} found), precision ${run.precisionPercent}% (${String(run.invented)} invented), F1 ${run.f1Percent}%, measured from \`${run.reproDir}\`. **That table is a property of the machine it was measured on.** Re-measured on a second machine — same code, same committed model, same pinned runtime, identical frames — the corpus gives recall ${second.recallPercent}% (${String(second.found)} of ${String(second.annotated)}), precision ${second.precisionPercent}% (${String(second.invented)} invented), F1 ${second.f1Percent}%. On 26 August the full corpus, prepared by the committed remux tool, was re-measured on the second machine and reproduced this table IDENTICALLY — every count, every percentage, every coverage number, digit for digit, across a different processor, operating system, WebKit binary and fifteen commits of instrument change. That reproduction is WebKit to WebKit — the corpus runner launches no other engine — so no engine other than WebKit has measured this corpus, and roadmap row 13.0 is the measurement that would change that. The apparent gap had been the files: that run's clips were re-encoded instead of remuxed, and re-encoding alone collapses false alarms on the worst clip from 19 to 3. So the number above is a measured property of the instrument and the prepared files on two machines — and NOT a property of arbitrarily transcoded copies, which is why the preparation is part of the result. The re-encoded table stays published as a record of that discovery; it is not an Eyeblink8 result. Full record: [docs/eyeblink8-result.txt](docs/eyeblink8-result.txt).`,
    `- **Does any of it track reported sleepiness?** On the small DROZY set, no — a null result, published as readily as a positive one would have been: nothing cleared the pre-registered bar on the ${String(drozy.analysed)} of ${String(drozy.measured)} DROZY sessions this instrument can measure. On the larger UTA-RLDD set, yes. Across ${String(uta.subjects)} self-recording strangers (${String(uta.analysed)} videos, and the model was never trained on anyone it was scored against), the pre-registered classifier separates a coarse self-reported drowsiness state better than chance: three-class balanced accuracy ${uta.threeClass} where guessing scores ${uta.threeFloor}, and alert-vs-drowsy ${uta.binary} where guessing scores ${uta.binaryFloor}, both past a 1000-shuffle label-scramble control at p ${uta.p}. The plan predicted a null in writing and was WRONG in the one way it had named — a weak effect that DROZY (13 people) and a 12-subject pilot were too small to see, and ${String(uta.subjects)} were not. It is MODEST and not driving-relevant: the label is self-reported and noisy, each person recorded one video per state so the clips differ in more than drowsiness, nobody was driving, and this stays a demo, not a safety or medical device. Full records: [docs/uta-rldd-result.txt](docs/uta-rldd-result.txt), [docs/drozy-result.txt](docs/drozy-result.txt). Cite: ${drozy.cite} ${uta.cite}`,
    `- **Does it work on other people?** Six volunteers, three pre-registered failure criteria: the detector's criterion ${round.detector}, the baseline's criterion ${round.baseline}, the frame-rate gate's criterion ${round.gate}. Full record: [docs/validation-round.txt](docs/validation-round.txt).`,
    `- **Limitations, stated plainly:** how many blinks it finds depends on how fast the viewer's computer is; the learned baseline was unusable on three of the six volunteer machines; the DROZY sample is missing its sleepiest sessions, so its null is weaker than a null on the ${String(drozy.measured)} it can measure; the UTA-RLDD detection is a modest classification-across-strangers result on a coarse self-reported label, not a validated per-person alertness meter; and the live 0–100 alertness score is a heuristic that, in a pre-registered test (roadmap 9.1), separated self-reported alert from drowsy across strangers above chance (AUC ${alertness.auc} at p ${alertness.p}), but has not been validated as a per-person measure of anyone's actual sleepiness.`,
    "",
    END_MARKER,
  ];
  return lines.join("\n");
}

/**
 * The emitted bullets in this generator's source that carry no parsed
 * value, by their opening words.
 *
 * Roadmap 10.0a3, ladder B5. A bullet with no `${...}` in it took no
 * number from any document, so nothing holds it to one: it is
 * hand-maintained prose living inside a generator, which is how "the
 * mechanism is unexplained" survived a month past the measurement that
 * explained it. The cannot-see generator answers the same question
 * with per-claim pins; this one has no claim objects, so the rule is
 * read off its own source.
 */
export function unpinnedLiterals(generatorSource) {
  return [...generatorSource.matchAll(/^\s{4}(["`])- \*\*([\s\S]*?)\1,$/gm)]
    .filter((match) => !match[2].includes("${"))
    .map((match) => match[2].slice(0, 60));
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
