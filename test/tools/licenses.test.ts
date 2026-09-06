import { describe, expect, it } from "vitest";

import { lockfileVision } from "../../tools/modelProvenance.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// The August 2026 audit found the built page redistributes Google's
// MediaPipe library and model under Apache-2.0 with no attribution
// anywhere in the output: zero occurrences of "Copyright" in the
// bundle, no notice file. Apache-2.0 requires the notice to travel
// with the redistribution, and this page is published.
//
// The notice lives in public/, which vite copies into dist verbatim,
// so it ships beside the page. These tests hold the source side; the
// end to end test in test/e2e/licenses.spec.ts proves the built site
// actually serves it.

const root = repoRoot();
const notice = readRepoFile("public/THIRD_PARTY_LICENSES.txt", root);

describe("the third party licence notice", () => {
  it("names what is redistributed and whose it is", () => {
    expect(notice).toContain("@mediapipe/tasks-vision");
    expect(notice).toContain("face_landmarker.task");
    expect(notice).toContain("Google LLC");
  });

  it("carries the full Apache-2.0 text, not a pointer to one", () => {
    // A pointer rots and a reader offline cannot follow it. The licence
    // itself requires the terms to accompany the work.
    expect(notice).toContain("Apache License");
    expect(notice).toContain("END OF TERMS AND CONDITIONS");
  });

  // Roadmap 10.0a2, ladder B18. The notice attributed
  // @mediapipe/tasks-vision 1.0.0 while the page shipped 1.0.1, and no
  // test read the version at all: the previous checks asked only for
  // the package NAME, which a wrong version passes. MODEL_CARD.md got
  // this right because modelProvenance recomputes it from the
  // lockfile, so the notice is held the same way.
  it("attributes the version the lockfile actually resolves", () => {
    expect(notice).toContain(
      `@mediapipe/tasks-vision ${lockfileVision(root).version}`,
    );
  });

  // The notice promises the font licences verbatim and then summarised
  // them, which is the one thing the Open Font License's own terms do
  // not allow: the licence has to travel with the fonts.
  it("carries the Open Font License in full, and each family it covers", () => {
    expect(notice).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(notice).toContain("PREAMBLE");
    expect(notice).toContain("TERMINATION");
    const styles = readRepoFile("src/styles.css", root);
    const families = [
      ...new Set(
        [...styles.matchAll(/@import "@fontsource\/([^/"]+)\//g)].map(
          (match) => match[1],
        ),
      ),
    ];
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(notice, `${family} is served and not attributed`).toContain(
        `@fontsource/${family}`,
      );
    }
  });

  it("names each font's own copyright holder, not just the licence", () => {
    expect(notice).toContain("The Inter Project Authors");
    expect(notice).toContain("IBM Corp.");
    expect(notice).toContain("The Space Grotesk Project Authors");
  });

  it("describes paths the repository actually ships", () => {
    // The notice points at /models/face_landmarker.task; if the model
    // moves or vanishes, the attribution must move with it.
    expect(notice).toContain("/models/face_landmarker.task");
    expect(
      readRepoFile("public/models/face_landmarker.task", root).length,
    ).toBeGreaterThan(0);
  });
});
