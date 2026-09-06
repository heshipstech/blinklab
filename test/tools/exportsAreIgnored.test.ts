import { describe, expect, it } from "vitest";

import {
  downloadedFilenames,
  gitRefusesToTrack,
  readText,
  repoRoot,
} from "../../tools/exportGuard.mjs";

// .gitignore refuses the per-second session export because an exported
// CSV is measurements of somebody's eyes and this repository is public.
// The blink log, added at 6.7 as a second download, was never covered,
// so until the August 2026 audit found it a user could have committed
// their own blink events by accident.
//
// These tests exist so a third export cannot repeat it.

const root = repoRoot();
const mainSource = readText(`${root}src/main.ts`);

const A_STAMP = "2026-08-10T10-00-00-000";

describe("downloadedFilenames", () => {
  it("fills the stamp in so the result is a name a download would produce", () => {
    const names = downloadedFilenames(
      "downloadTextFile(`blinklab-thing-${stamp}.csv`, body, type);",
    );
    expect(names).toEqual([`blinklab-thing-${A_STAMP}.csv`]);
  });

  it("finds every download in a file, not only the first", () => {
    const names = downloadedFilenames(
      "downloadTextFile(`a-${s}.csv`, x);\ndownloadTextFile(`b-${s}.csv`, y);",
    );
    expect(names).toEqual([`a-${A_STAMP}.csv`, `b-${A_STAMP}.csv`]);
  });

  it("finds nothing in a file that downloads nothing", () => {
    expect(downloadedFilenames("const x = 1;")).toEqual([]);
  });

  // Roadmap 10.1c, ladder D16. The reader matched backtick calls only,
  // and main.ts downloads the fixture recording with a double-quoted
  // literal. That file is 478 face-mesh points of whoever was in front
  // of the camera, and it sat outside .gitignore because the guard
  // could not see it.
  it("finds a plain quoted download, not only a template one", () => {
    expect(
      downloadedFilenames('downloadTextFile("session-01.json", body);'),
    ).toEqual(["session-01.json"]);
    expect(downloadedFilenames("downloadTextFile('a.json', body);")).toEqual([
      "a.json",
    ]);
  });

  it("finds all three quote styles in one file, in source order", () => {
    expect(
      downloadedFilenames(
        'downloadTextFile("one.json", a);\n' +
          "downloadTextFile(`two-${s}.csv`, b);\n" +
          "downloadTextFile('three.txt', c);",
      ),
    ).toEqual(["one.json", `two-${A_STAMP}.csv`, "three.txt"]);
  });
});

describe("every file the app downloads is refused by .gitignore", () => {
  it("reads the downloads out of main.ts rather than hard-coding them", () => {
    const names = downloadedFilenames(mainSource);
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names.some((n) => n.startsWith("blinklab-session-"))).toBe(true);
    expect(names.some((n) => n.startsWith("blinklab-blinks-"))).toBe(true);
    // The development-only fixture recording, downloaded with a plain
    // quoted name. It is landmark geometry of a real face.
    expect(names).toContain("session-01.json");
  });

  it("refuses the per-second session export", () => {
    expect(gitRefusesToTrack(`blinklab-session-${A_STAMP}.csv`, root)).toBe(
      true,
    );
  });

  it("refuses the blink log export, the one the audit found uncovered", () => {
    expect(gitRefusesToTrack(`blinklab-blinks-${A_STAMP}.csv`, root)).toBe(
      true,
    );
  });

  it("refuses every download main.ts can produce, including any added later", () => {
    const unignored = downloadedFilenames(mainSource).filter(
      (name) => !gitRefusesToTrack(name, root),
    );
    expect(unignored).toEqual([]);
  });

  it("would notice a new export that nobody ignored", () => {
    // The guard's own guard. A name of the shape a future export would
    // take, deliberately absent from .gitignore, must come back
    // trackable. If this ever passes, the check above has stopped
    // meaning anything and is quietly agreeing with everything.
    expect(gitRefusesToTrack(`blinklab-pupil-${A_STAMP}.csv`, root)).toBe(
      false,
    );
  });
});
