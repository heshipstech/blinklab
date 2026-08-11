import { describe, expect, it } from "vitest";

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

  it("describes paths the repository actually ships", () => {
    // The notice points at /models/face_landmarker.task; if the model
    // moves or vanishes, the attribution must move with it.
    expect(notice).toContain("/models/face_landmarker.task");
    expect(
      readRepoFile("public/models/face_landmarker.task", root).length,
    ).toBeGreaterThan(0);
  });
});
