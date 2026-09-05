import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The August 2026 audit found the numbers right and the prose rotten:
// STATE.md's own reproduction command printed the retired 82.8% against
// a README headline of 87.7%, the withdrawn-glasses paragraph printed
// the superseded run's split while calling it corrected, and three
// documents carried two different test counts, neither of them true.
//
// Every one of those sentences was written correctly and then the run
// changed underneath it. So the fix is not "update the prose", which is
// what the project did twice before. The fix is a guard that reads the
// COMMITTED RESULT FILE, docs/eyeblink8-result.txt, and fails the build
// when a summary document stops agreeing with it. The result file is
// already the single source of truth; this makes disagreeing with it a
// red build instead of a finding in the next audit.
//
// Same arrangement as bundleGuard, exportGuard and claimGuard: plain
// .mjs that reads the disk, hand-written types next door, callers type
// checked.

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot() {
  // Not `new URL(...).pathname`: this project lives in a folder with a
  // space in its name, so pathname percent-encodes it and every read
  // fails. That trap is now three for three in this repository.
  return fileURLToPath(new URL("../", import.meta.url));
}

/** Read a file as text, relative to the repository root. */
export function readRepoFile(relativePath, root) {
  return readFileSync(join(root, relativePath), "utf8");
}

/**
 * The current run's numbers, parsed out of docs/eyeblink8-result.txt.
 *
 * The file keeps superseded runs below the current one on purpose, so
 * every pattern here takes the FIRST match, which is the current run.
 * Throws rather than returning a partial object: a result file this
 * cannot parse is itself a finding, not something to skip past.
 */
export function parseResultFile(text) {
  const grab = (pattern, what) => {
    const match = text.match(pattern);
    if (match === null) {
      throw new Error(`result file: could not find ${what}`);
    }
    return match;
  };

  const recall = grab(
    /Recall\s+([\d.]+)%\s+\((\d+) of (\d+) found\)/,
    "the recall line",
  );
  const precision = grab(
    /Precision\s+([\d.]+)%\s+\((\d+) invented\)/,
    "the precision line",
  );
  const f1 = grab(/F1\s+([\d.]+)%/, "the F1 line");
  const withGlasses = grab(
    /with glasses\s+1 clip\(s\), recall ([\d.]+)%, precision ([\d.]+)%/,
    "the with-glasses split",
  );
  const withoutGlasses = grab(
    /without\s+7 clip\(s\), recall ([\d.]+)%, precision ([\d.]+)%/,
    "the without-glasses split",
  );
  const reproDir = grab(
    /"\$DATASETS\/(eyeblink8-measured-[a-z0-9-]+)"/,
    "the reproduction directory",
  );
  const misses = grab(
    /(\d+) misses, of which (\d+) carry at least one frame\s+the human marked fully closed, ([\d.]+)%/,
    "the rebuilt miss figures",
  );

  return {
    recallPercent: recall[1],
    found: Number(recall[2]),
    annotated: Number(recall[3]),
    precisionPercent: precision[1],
    invented: Number(precision[2]),
    f1Percent: f1[1],
    glasses: { recall: withGlasses[1], precision: withGlasses[2] },
    noGlasses: { recall: withoutGlasses[1], precision: withoutGlasses[2] },
    reproDir: reproDir[1],
    missTotal: Number(misses[1]),
    missFullyClosed: Number(misses[2]),
    missPercent: misses[3],
  };
}

/**
 * The number a document states immediately before the words "unit
 * tests", or null if it makes no such claim. Every summary document
 * that publishes a test count is held to the real one.
 */
export function statedUnitTestCount(docText) {
  const match = docText.match(/(\d+) unit tests/);
  return match === null ? null : Number(match[1]);
}

/** The number a document states before "Python tests", or null. */
export function statedPythonTestCount(docText) {
  const match = docText.match(/(\d+) Python tests/);
  return match === null ? null : Number(match[1]);
}

/** Count `it(` and `test(` calls across test/**\/*.test.ts, recursively. */
export function actualUnitTestCount(root) {
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), {
      withFileTypes: true,
    })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".test.ts")) {
        const source = readFileSync(join(root, path), "utf8");
        count += (source.match(/\b(?:it|test)\(/g) ?? []).length;
      }
    }
  };
  walk("test");
  return count;
}

/** Count `def test_` functions across analysis/tests. */
export function actualPythonTestCount(root) {
  let count = 0;
  for (const entry of readdirSync(join(root, "analysis/tests"))) {
    if (entry.endsWith(".py")) {
      const source = readFileSync(join(root, "analysis/tests", entry), "utf8");
      count += (source.match(/\bdef test_/g) ?? []).length;
    }
  }
  return count;
}

// The dated stamp. During the audit, MODEL_CARD.md's "written 9 August
// against the state of main on that date" converted what would have
// been a contradiction finding into a correctly scoped snapshot, the
// cheapest defence in the repository. README.md and STATE.md carry the
// same stamp now, and the rule is enforced rather than remembered:
// when a stamped file changes, its stamp must change with it.

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DATE_WORDS =
  /(?:Stamped:\s*|Written\s+|[Rr]evised\s+)(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g;

/**
 * The newest date in a document's stamp, as "YYYY-MM-DD", or null when
 * the document carries no stamp.
 *
 * A date only counts when it sits in a real stamp sentence: either
 * behind "Stamped:", or behind "Written"/"revised" within a sentence
 * that also says "against the state of". Prose in this repository
 * narrates dates constantly ("the application, revised 28 August
 * 2026") and a prose date newer than the real stamp would silently
 * mask a stale one, which is this project's recurring defect wearing
 * yet another coat.
 */
export function newestStampDate(docText) {
  let newest = null;
  const consider = (day, monthWord, year) => {
    const month = String(MONTHS[monthWord.toLowerCase()]).padStart(2, "0");
    const iso = `${year}-${month}-${day.padStart(2, "0")}`;
    if (newest === null || iso > newest) {
      newest = iso;
    }
  };
  DATE_WORDS.lastIndex = 0;
  let match = DATE_WORDS.exec(docText);
  while (match !== null) {
    const isStampedForm = match[0].startsWith("Stamped:");
    // The stamp sentence runs from this date to the next full stop;
    // "against the state of" must appear inside it, or just after the
    // comma-joined clause MODEL_CARD uses.
    const tail = docText.slice(match.index, match.index + 160);
    const inStampSentence = tail
      .split(/\.\s/)[0]
      .concat(tail)
      .includes("against the state of");
    if (isStampedForm || inStampSentence) {
      consider(match[1], match[2], match[3]);
    }
    match = DATE_WORDS.exec(docText);
  }
  return newest;
}

/** The date of the last commit touching a file, "YYYY-MM-DD", or null. */
export function lastCommitDateFor(relativePath, root) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", relativePath],
      { cwd: root, encoding: "utf8" },
    ).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Whether the checkout is shallow. A depth-1 clone reports every file
 * as last touched by its single tip commit, which would force a stamp
 * bump on every pull request whether or not the file changed, so the
 * staleness comparison is only meaningful with full history. CI fetches
 * full history for exactly this reason.
 */
export function isShallowRepo(root) {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    return out === "true";
  } catch {
    return true;
  }
}

/**
 * Whether this run is continuous integration. GitHub Actions always
 * sets CI; the pin test uses this because the shallow-repo skip is
 * only safe where a shallow checkout is guaranteed not to happen.
 */
export function runningInCi() {
  return process.env.CI !== undefined;
}

/**
 * MODEL_CARD's measurement-uncertainty section, or null when absent.
 *
 * Roadmap 10.1b. The published precision is a property of the video
 * preparation as much as of the detector, and blink duration is
 * device-conditioned with its mechanism open. Those conditions are part
 * of the numbers, so the card states them and the test holds the
 * section to the committed results: the invented count quoted there
 * must be the result file's own, and the two measured conditions must
 * keep their committed figures.
 */
export function uncertaintySection(cardText) {
  const match = cardText.match(
    /## Measurement uncertainty\n([\s\S]*?)(?=\n## |$)/,
  );
  return match === null ? null : match[1];
}
