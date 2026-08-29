import { readRepoFile, parseResultFile } from "./resultGuard.mjs";
import { parseDrozyResult } from "./resultsBlock.mjs";

// Assessment pilot increment 2 (docs/assessment-pilot-plan.md): the
// participant report's "what this instrument cannot see" section,
// generated from the published record rather than hand-maintained —
// the resultsBlock mechanism applied to caveats. Every claim is
// quote-pinned against the exact sentence in its source document, so
// a source that changes its mind breaks the build here instead of a
// report quietly overstating what the instrument can do. A build
// missing a required number or the DROZY citation throws: a weaker
// caveat block must never be emitted silently.
//
// Same arrangement as resultsBlock, bundleGuard, exportGuard: plain
// .mjs that reads the disk, hand-written types next door, callers
// type checked.

/**
 * Assert a quoted sentence exists in its source, whitespace-collapsed
 * on both sides: source documents hard-wrap prose, and a pin must not
 * fail because a sentence breaks across lines.
 */
export function assertQuote(sourceText, quote, sourcePath) {
  const collapse = (text) => text.replace(/\s+/g, " ");
  if (!collapse(sourceText).includes(collapse(quote))) {
    throw new Error(
      `cannot-see block: the pinned sentence ${JSON.stringify(
        quote,
      )} is no longer in ${sourcePath} — the source changed its mind, ` +
        `so the claim must be re-derived, not silently kept`,
    );
  }
}

/** The claims, each pinned to its sources; throws on any missing pin. */
export function buildCannotSeeClaims(root) {
  const result = readRepoFile("docs/eyeblink8-result.txt", root);
  const missChar = readRepoFile("docs/miss-character.txt", root);
  const dryRun = readRepoFile("docs/validation-dry-run.txt", root);
  const round = readRepoFile("docs/validation-round.txt", root);
  const refusal = readRepoFile("docs/calibration-refusal.txt", root);
  const freeze = readRepoFile("docs/baseline-freeze.txt", root);
  const card = readRepoFile("MODEL_CARD.md", root);
  const drozyText = readRepoFile("docs/drozy-result.txt", root);

  const parsed = parseResultFile(result);
  const missed = parsed.annotated - parsed.found;
  const closedShare = (() => {
    const match =
      missChar.match(/against the overall ([\d.]+)\s*$/m) ??
      missChar.match(/the overall ([\d.]+)\s+percent/);
    if (match === null) {
      throw new Error(
        "cannot-see block: docs/miss-character.txt no longer states " +
          "the overall closed-frame share",
      );
    }
    return match[1];
  })();

  assertQuote(
    missChar,
    "the rearm run did not just reproduce the counts, it missed exactly the same blinks",
    "docs/miss-character.txt",
  );
  assertQuote(
    dryRun,
    "the evidence rate cannot explain why one missed 3 of 10 and the other caught 10 of 10",
    "docs/validation-dry-run.txt",
  );
  assertQuote(
    card,
    "not comparable to a PERCLOS figure from another system",
    "MODEL_CARD.md",
  );
  assertQuote(
    round,
    "a missed blink writes no row",
    "docs/validation-round.txt",
  );
  assertQuote(
    refusal,
    "the future is not available at birth",
    "docs/calibration-refusal.txt",
  );
  assertQuote(
    refusal,
    "over_resting below 1.0",
    "docs/calibration-refusal.txt",
  );
  assertQuote(
    freeze,
    "A short ruler now stays short",
    "docs/baseline-freeze.txt",
  );
  assertQuote(card, "it would be dishonest to imply it does", "MODEL_CARD.md");
  assertQuote(
    card,
    "It has never been shown to correspond to how sleepy anyone",
    "MODEL_CARD.md",
  );
  // parseDrozyResult itself refuses when the null-verdict sentence or
  // the citation is missing — the written permission's condition.
  const drozy = parseDrozyResult(drozyText);

  return [
    {
      claim:
        `Ordinary blinks it simply misses. On the benchmark it was scored ` +
        `against, ${String(missed)} of ${String(parsed.annotated)} annotated ` +
        `blinks — about one in six — were missed at healthy frame rates, ` +
        `deterministically: the same ${String(missed)} blinks every run, ` +
        `${closedShare} percent of them containing a frame a human marked ` +
        `fully closed. The mechanism is unexplained.`,
      source: "docs/eyeblink8-result.txt; docs/miss-character.txt",
    },
    {
      claim:
        `Whether another device would agree. Two phones measured at the ` +
        `same evidence rate found different blinks, and that difference is ` +
        `unexplained, so numbers from this device are not comparable to ` +
        `numbers from another.`,
      source: "docs/validation-dry-run.txt; docs/blink-sample-rate.txt",
    },
    {
      claim:
        `A PERCLOS anyone else would recognise. The eyes-closed share here ` +
        `uses an instrument-adjusted threshold, not the literature's, and ` +
        `is not comparable to a PERCLOS figure from another system.`,
      source: "MODEL_CARD.md",
    },
    {
      claim:
        `Its own misses. A missed blink writes no row, so the blink log is ` +
        `censored and cannot count what it failed to see.`,
      source: "docs/validation-round.txt",
    },
    {
      claim:
        `Two calibration failures invisible at birth: a learning window ` +
        `that reads uniformly high (the future is not available at ` +
        `calibration time), and a ruler born short through a squint, ` +
        `visible only afterwards as over_resting below 1.0 — and a ruler ` +
        `born short stays short, by the freeze's own stated trade.`,
      source: "docs/calibration-refusal.txt; docs/baseline-freeze.txt",
    },
    {
      claim:
        `Who it fails for. The face model has not been tested across age, ` +
        `skin tone, eye shape, visual impairment or eyewear here, and it ` +
        `would be dishonest to imply equal performance.`,
      source: "MODEL_CARD.md",
    },
    {
      claim:
        `Sleepiness. The alertness score is a heuristic that has never ` +
        `been shown to correspond to how sleepy anyone actually is; on ` +
        `the ${String(drozy.analysed)} sessions of the one labelled dataset this ` +
        `instrument can measure, nothing cleared the pre-registered bar. ` +
        `Cite: ${drozy.cite}.`,
      source: "MODEL_CARD.md; docs/drozy-result.txt",
    },
  ];
}

/** The whole generated module, byte for byte. */
export function buildCannotSeeModule(root) {
  const claims = buildCannotSeeClaims(root);
  const rows = claims
    .map(
      (entry) =>
        `  {\n    claim:\n      ${JSON.stringify(entry.claim)},\n` +
        `    source: ${JSON.stringify(entry.source)},\n  },`,
    )
    .join("\n");
  return (
    `// GENERATED by tools/cannotSeeBlock.mjs — do not edit by hand.\n` +
    `// Edit the source documents, then regenerate with:\n` +
    `// npm run cannotsee:write\n` +
    `// A test compares this committed module to the generator's\n` +
    `// output and fails when they drift; every claim is quote-pinned\n` +
    `// against the exact sentence in its source document, so a source\n` +
    `// that changes its mind breaks the build rather than letting a\n` +
    `// report overstate what the instrument can do.\n` +
    `\n` +
    `/** One thing this instrument cannot see, and where that is proven. */\n` +
    `export type CannotSeeClaim = {\n` +
    `  claim: string;\n` +
    `  source: string;\n` +
    `};\n` +
    `\n` +
    `export const CANNOT_SEE_CLAIMS: readonly CannotSeeClaim[] = [\n` +
    `${rows}\n` +
    `];\n`
  );
}
