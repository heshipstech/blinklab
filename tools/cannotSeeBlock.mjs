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

/**
 * Claims that carry no pin at all, by their opening words.
 *
 * Roadmap 10.0a3, ladder B5. A generator exists so published prose
 * cannot drift from the record; a claim that is neither built around a
 * parsed value nor pinned to a quoted sentence is hand-maintained
 * prose wearing a generator's coat, and this repository published one
 * for a month ("The mechanism is unexplained", explained on
 * 2 September in docs/iris-occlusion.txt).
 */
export function claimsWithoutPins(claims) {
  return claims
    .filter((entry) => entry.pins.length === 0)
    .map((entry) => entry.claim);
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
  const iris = readRepoFile("docs/iris-occlusion.txt", root);

  const parsed = parseResultFile(result);
  const missed = parsed.annotated - parsed.found;
  // Roadmap 10.0a3, ladder B5. The generator said the mechanism was
  // unexplained for a month after docs/iris-occlusion.txt explained
  // it, so the number that settles it is parsed rather than typed.
  const ceilingMisses = (() => {
    const match = iris.match(/Of the \d+ misses, ~(\d+) are this ceiling/);
    if (match === null) {
      throw new Error(
        "cannot-see block: docs/iris-occlusion.txt no longer states how " +
          "many of the misses are the recall ceiling",
      );
    }
    return match[1];
  })();
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
        `fully closed. About ${ceilingMisses} of them are a measured ` +
        `ceiling rather than a tunable defect: on those closures the ` +
        `eyelid aperture and the iris shape are both flat, so this face ` +
        `model does not register them and no threshold move or signal ` +
        `fusion can recover a signal that is not there.`,
      source:
        "docs/eyeblink8-result.txt; docs/miss-character.txt; " +
        "docs/iris-occlusion.txt",
      pins: [
        {
          quote: "CEILING, not a tunable defect",
          path: "docs/iris-occlusion.txt",
        },
        {
          quote:
            "the rearm run did not just reproduce the counts, it missed exactly the same blinks",
          path: "docs/miss-character.txt",
        },
      ],
    },
    {
      claim:
        `Whether another device would agree. Two phones measured at the ` +
        `same evidence rate found different blinks, and that difference is ` +
        `unexplained, so numbers from this device are not comparable to ` +
        `numbers from another.`,
      source: "docs/validation-dry-run.txt; docs/blink-sample-rate.txt",
      pins: [
        {
          quote:
            "the evidence rate cannot explain why one missed 3 of 10 and the other caught 10 of 10",
          path: "docs/validation-dry-run.txt",
        },
      ],
    },
    {
      claim:
        `A PERCLOS anyone else would recognise. The eyes-closed share here ` +
        `uses an instrument-adjusted threshold, not the literature's, and ` +
        `is not comparable to a PERCLOS figure from another system.`,
      source: "MODEL_CARD.md",
      pins: [
        {
          quote: "not comparable to a PERCLOS figure from another system",
          path: "MODEL_CARD.md",
        },
      ],
    },
    {
      claim:
        `Its own misses. A missed blink writes no row, so the blink log is ` +
        `censored and cannot count what it failed to see.`,
      source: "docs/validation-round.txt",
      pins: [
        {
          quote: "a missed blink writes no row",
          path: "docs/validation-round.txt",
        },
      ],
    },
    {
      claim:
        `Two calibration failures invisible at birth: a learning window ` +
        `that reads uniformly high (the future is not available at ` +
        `calibration time), and a ruler born short through a squint, ` +
        `visible only afterwards as over_resting below 1.0 — and a ruler ` +
        `born short stays short, by the freeze's own stated trade.`,
      source: "docs/calibration-refusal.txt; docs/baseline-freeze.txt",
      pins: [
        {
          quote: "the future is not available at birth",
          path: "docs/calibration-refusal.txt",
        },
        {
          quote: "over_resting below 1.0",
          path: "docs/calibration-refusal.txt",
        },
        {
          quote: "A short ruler now stays short",
          path: "docs/baseline-freeze.txt",
        },
      ],
    },
    {
      claim:
        `Who it fails for. The face model has not been tested across age, ` +
        `skin tone, eye shape, visual impairment or eyewear here, and it ` +
        `would be dishonest to imply equal performance.`,
      source: "MODEL_CARD.md",
      pins: [
        {
          quote: "it would be dishonest to imply it does",
          path: "MODEL_CARD.md",
        },
      ],
    },
    {
      claim:
        `Sleepiness. The alertness score is a heuristic that has never ` +
        `been shown to correspond to how sleepy anyone actually is; on ` +
        `the ${String(drozy.analysed)} sessions of the one labelled dataset this ` +
        `instrument can measure, nothing cleared the pre-registered bar. ` +
        // The citation carries its own full stop; appending another
        // printed "WACV 2016.." on the dry run's report.
        `Cite: ${drozy.cite.replace(/\.$/, "")}.`,
      source: "MODEL_CARD.md; docs/drozy-result.txt",
      pins: [
        {
          quote: "It has never been shown to correspond to how sleepy anyone",
          path: "MODEL_CARD.md",
        },
      ],
    },
  ];
}

/**
 * The whole generated module, byte for byte.
 *
 * The pins stay in the generator and never reach the browser: they are
 * how a claim earns its place here, not something a participant reads,
 * and this page ships under a bundle budget.
 */
export function buildCannotSeeModule(root) {
  const claims = buildCannotSeeClaims(root);
  const unpinned = claimsWithoutPins(claims);
  if (unpinned.length > 0) {
    throw new Error(
      `cannot-see block: ${String(unpinned.length)} claim(s) carry no ` +
        `pin, so nothing holds them to a document: ` +
        unpinned.map((claim) => JSON.stringify(claim.slice(0, 60))).join(", "),
    );
  }
  const rows = claims
    .map(
      (entry) =>
        `  {\n    claim:\n      ${JSON.stringify(entry.claim)},\n` +
        // The formatter breaks an assignment whose value will not fit
        // in 80 columns, and the committed module is compared to this
        // output byte for byte, so the generator has to make the same
        // choice the formatter would. A one-line source that fits stays
        // on one line; a longer one takes the wrapped shape.
        (`    source: ${JSON.stringify(entry.source)},`.length > 80
          ? `    source:\n      ${JSON.stringify(entry.source)},\n  },`
          : `    source: ${JSON.stringify(entry.source)},\n  },`),
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
