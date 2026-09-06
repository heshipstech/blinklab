import { readRepoFile } from "./resultGuard.mjs";

// Roadmap 10.0a2, ladder B2. README's Privacy section enumerated the
// storage this app touches, said there were two keys, and finished
// with "those two keys are the only storage this app touches". There
// are four. The blink line and the pseudonym each arrived with tests,
// an erase control and an entry in the interface's own list, and the
// README paragraph was never revisited, because nothing could fail
// when it and the code disagreed.
//
// A paragraph that enumerates is a paragraph that rots, so this one is
// generated from STORED_ITEMS, the same list the page renders from,
// and from the export disclosure the page shows beside its export
// buttons. Its test rebuilds the block and fails when the committed
// README has drifted.
//
// Same arrangement as resultsBlock and cannotSeeBlock: plain .mjs that
// reads the disk, hand-written types next door, callers type checked.

const BEGIN_MARKER = "<!-- privacy:begin -->";
const END_MARKER = "<!-- privacy:end -->";

/**
 * The stored items out of src/core/storedData.ts, in source order.
 *
 * Read as text rather than imported, so this stays a plain script with
 * no build step between it and the disk. Throws on an empty result: a
 * generator that silently produced no items would write a Privacy
 * section saying the app stores nothing, which is the original defect
 * with a guard standing in front of it.
 */
export function storedItems(storedDataSource) {
  const found = [
    ...storedDataSource.matchAll(
      /\{\s*key:\s*"([^"]+)",\s*what:\s*"([^"]+)",\s*why:\s*"([^"]+)",\s*\}/g,
    ),
  ].map((match) => ({ key: match[1], what: match[2], why: match[3] }));
  if (found.length === 0) {
    throw new Error(
      "privacy block: no items found in src/core/storedData.ts — the " +
        "shape of STORED_ITEMS changed, and an empty list here would " +
        "publish a Privacy section claiming nothing is stored",
    );
  }
  return found;
}

/**
 * The export disclosure sentence out of src/core/exportContents.ts.
 *
 * The constant is a concatenation of string literals, so the pieces
 * are read and joined the way the compiler would. Throws when the
 * constant is gone.
 */
export function exportSentence(exportContentsSource) {
  const body = exportContentsSource.match(
    /export const EXPORT_CONTENTS =([\s\S]*?);\n/,
  );
  if (body === null) {
    throw new Error(
      "privacy block: EXPORT_CONTENTS is no longer in " +
        "src/core/exportContents.ts",
    );
  }
  return [...body[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((match) => match[1].replace(/\\"/g, '"'))
    .join("");
}

/** The generated block, markers included, byte for byte what README must carry. */
export function buildPrivacyBlock(root) {
  const items = storedItems(readRepoFile("src/core/storedData.ts", root));
  const sentence = exportSentence(
    readRepoFile("src/core/exportContents.ts", root),
  );
  const lines = [
    BEGIN_MARKER,
    "<!-- Generated from src/core/storedData.ts and",
    "src/core/exportContents.ts by tools/privacyBlock.mjs. Edit those,",
    "then regenerate with: npm run privacy:write. A test regenerates",
    "this block and fails when the committed README drifts from it. -->",
    "",
    `**${String(items.length)} things are kept on your device, and the page lists all of them and offers to erase them.**`,
    "",
    ...items.map((item) => `- \`${item.key}\` — ${item.what}, ${item.why}.`),
    "",
    'A "Stored on this device" box at the bottom of the page names each of these, says which are present right now, and erases them on request. The erase clears the profile the running session is holding as well, so the heatmap goes back to asking you to calibrate, and the confirmation it prints is read back from the browser after the fact rather than assumed, because a delete that quietly does nothing is worse than one that fails loudly.',
    "",
    `**What an exported file contains.** ${sentence} The browser string is written in a reduced form by default, naming the browser, its major version and the platform family and nothing else; a checkbox beside the export buttons writes the full string instead, and a \`user_agent_form\` row in the file says which form you got.`,
    "",
    END_MARKER,
  ];
  return lines.join("\n");
}

/** README with its privacy block replaced. Throws when the markers are missing or doubled. */
export function splicePrivacyBlock(readmeText, block) {
  const begin = readmeText.indexOf(BEGIN_MARKER);
  const end = readmeText.indexOf(END_MARKER);
  if (begin === -1 || end === -1) {
    throw new Error("README has no privacy markers to splice between");
  }
  if (
    readmeText.indexOf(BEGIN_MARKER, begin + 1) !== -1 ||
    readmeText.indexOf(END_MARKER, end + 1) !== -1
  ) {
    throw new Error("README has more than one privacy block");
  }
  if (end < begin) {
    throw new Error("README's privacy markers are in the wrong order");
  }
  return (
    readmeText.slice(0, begin) +
    block +
    readmeText.slice(end + END_MARKER.length)
  );
}

/** The committed block as it stands in the README, markers included. */
export function committedPrivacyBlock(readmeText) {
  const begin = readmeText.indexOf(BEGIN_MARKER);
  const end = readmeText.indexOf(END_MARKER);
  if (begin === -1 || end === -1) {
    throw new Error("README has no privacy block");
  }
  return readmeText.slice(begin, end + END_MARKER.length);
}

/**
 * README's whole Privacy section, generated part and prose alike.
 *
 * The roadmap's check is that every stored key is found in the Privacy
 * SECTION, not merely somewhere in a long file, so the section is
 * extracted and the keys are looked for inside it.
 */
export function privacySection(readmeText) {
  const start = readmeText.indexOf("\n## Privacy\n");
  if (start === -1) {
    throw new Error("README has no Privacy section");
  }
  const after = readmeText.indexOf("\n## ", start + 1);
  return readmeText.slice(start, after === -1 ? undefined : after);
}
