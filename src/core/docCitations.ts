import { REPOSITORY_URL } from "./pageIdentity";

// Roadmap 14.0f2 [E7]. The page cites its own evidence and gives no
// way to reach it.
//
// The conditions sentences beside the blink count and the PERCLOS
// share end in `(docs/sampling-bounds.txt)` and the like: a path, in
// plain text, on a page served from a domain where that path means
// nothing. The honesty apparatus this project spent whole phases
// building — the committed measurements, the pre-registered
// predictions, the results that came back wrong and stayed published —
// sits one click from the visitor, and the click does not exist.
//
// The links are pinned to the COMMIT the page was built from rather
// than to a branch. A link to `main` shows a reader today's document
// beside a number measured last week, which is the same class of
// defect as a stale figure and the exact thing this project's dated
// stamps exist to prevent. The build already writes its commit into a
// `<meta name="build-commit">` tag, so the pin costs nothing new.

/**
 * A cited document path, matched the way it appears in prose.
 *
 * The character class contains a dot and the extension is anchored, so
 * a citation that ends a sentence gives up the full stop rather than
 * swallowing it. That is not a detail: this repository has twice
 * shipped a reader that treated the dot as a sentence terminator, in a
 * document where every row id contains one. Here the same character
 * separates an extension and ends a sentence, and the two cases are a
 * backtrack apart.
 */
const CITATION = /docs\/[A-Za-z0-9._/-]+\.(?:txt|md)/g;

/** Every document a sentence cites, in the order it cites them. */
export function citedDocs(text: string): string[] {
  return [...text.matchAll(CITATION)].map((match) => match[0]);
}

export type CitationSegment =
  { kind: "text"; text: string } | { kind: "doc"; path: string };

/**
 * A sentence split into the pieces the page renders: plain text and
 * the documents it cites.
 *
 * Empty text segments are dropped, so a citation that ends a sentence
 * does not leave a node rendering nothing.
 *
 * The property that matters is that joining the pieces back together
 * returns the sentence unchanged, character for character. The
 * sentences themselves live in core and are pinned against their
 * committed documents; turning one into links must not be a way to
 * edit it.
 */
export function citationSegments(sentence: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  let cursor = 0;
  for (const match of sentence.matchAll(CITATION)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ kind: "text", text: sentence.slice(cursor, start) });
    }
    segments.push({ kind: "doc", path: match[0] });
    cursor = start + match[0].length;
  }
  if (cursor < sentence.length) {
    segments.push({ kind: "text", text: sentence.slice(cursor) });
  }
  return segments;
}

/**
 * Where a citation points, on the commit the page was built from.
 *
 * `buildCommit` is what the build stamped into the page. Vite writes
 * "dev" when `GITHUB_SHA` is absent, which is the honest answer for a
 * build that came from a working tree, and a page with no stamp at all
 * gives null. Both fall back to `main`: there is no commit to pin to,
 * and the person following the link from a local build is the person
 * who has the working tree in front of them.
 *
 * Refuses a path that is not a citation rather than linking to it. A
 * link builder that accepts any string is a way to put an arbitrary
 * URL on the page from something that reached it by accident.
 */
export function docUrl(path: string, buildCommit: string | null): string {
  if (!new RegExp(`^${CITATION.source}$`).test(path)) {
    return raiseNotACitation(path);
  }
  const ref =
    buildCommit === null || buildCommit === "" || buildCommit === "dev"
      ? "main"
      : buildCommit;
  return `${REPOSITORY_URL}/blob/${ref}/${path}`;
}

function raiseNotACitation(path: string): never {
  throw new Error(
    `"${path}" is not a citation this page may link to. Citations are ` +
      "committed documents under docs/, and a link builder that accepts " +
      "anything is a way to put an arbitrary URL on the page from a " +
      "string that reached it by accident",
  );
}
