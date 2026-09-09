import { describe, expect, it } from "vitest";

import {
  bundledBrowsers,
  cardInstrument,
  cardProvenance,
  groupedExclusions,
  landmarkerOptions,
  lockfilePlaywright,
  lockfileVision,
  modelHash,
  runnerEngine,
} from "../../tools/modelProvenance.mjs";
import { DETECTOR_SOURCES } from "../../tools/detectorRatchet.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.2. Every published corpus number was produced by a
// specific model file, a specific runtime, and specific landmarker
// options — swap any of them and the numbers describe an instrument
// that no longer exists. The card now states all three, and these
// tests recompute them from the committed artifacts, so a model swap
// or an option flip that leaves the card unchanged is a red build.
// The blendshape work (12.2) lands against exactly this tripwire.

const root = repoRoot();
const card = readRepoFile("MODEL_CARD.md", root);
const stated = cardProvenance(card);

describe("parsing the card's provenance section", () => {
  it("returns null when the card has no such section", () => {
    expect(cardProvenance("## Privacy\n\nwords")).toBeNull();
  });

  it("exists in the committed card, with a full-length hash", () => {
    expect(
      stated,
      "MODEL_CARD.md has lost its Model provenance",
    ).not.toBeNull();
    expect(stated?.modelSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the model file", () => {
  it("hashes to exactly what the card states", () => {
    expect(modelHash(root)).toBe(stated?.modelSha256);
  });
});

describe("the runtime package", () => {
  it("matches the card's stated version", () => {
    expect(lockfileVision(root).version).toBe(stated?.packageVersion);
  });

  it("the card's integrity prefix is the lockfile's own", () => {
    // The full sha512 lives in package-lock.json; the card carries a
    // prefix long enough to be unforgeable by coincidence.
    const prefix = stated?.integrityPrefix ?? "";
    expect(prefix.length).toBeGreaterThanOrEqual(24);
    expect(lockfileVision(root).integrity.startsWith(prefix)).toBe(true);
  });
});

describe("the landmarker options", () => {
  it("parses a synthetic source with every option present", () => {
    const source = `
      delegate: "CPU",
      runningMode: "IMAGE",
      numFaces: 2,
      outputFacialTransformationMatrixes: false,
      outputFaceBlendshapes: true,
    `;
    expect(landmarkerOptions(source)).toEqual({
      delegate: "CPU",
      runningMode: "IMAGE",
      numFaces: 2,
      outputFacialTransformationMatrixes: false,
      outputFaceBlendshapes: true,
    });
  });

  it("reads an absent blendshape flag as disabled, never as unknown", () => {
    const source = 'delegate: "GPU",\nrunningMode: "VIDEO",\nnumFaces: 1,';
    expect(landmarkerOptions(source).outputFaceBlendshapes).toBe(false);
  });

  it("the real source matches the card, option for option", () => {
    const real = landmarkerOptions(readRepoFile("src/io/landmarker.ts", root));
    expect(real.delegate).toBe(stated?.delegate);
    expect(real.runningMode).toBe(stated?.runningMode);
    expect(real.numFaces).toBe(stated?.numFaces);
    // The card must also be honest about what is NOT enabled: 12.2
    // flips this, and the card and this pin flip with it or CI reds.
    expect(real.outputFaceBlendshapes).toBe(stated?.outputFaceBlendshapes);
    expect(real.outputFacialTransformationMatrixes).toBe(true);
  });
});

describe("the ratchet watches the model too", () => {
  it("the model file and the loader are detector sources now", () => {
    expect(DETECTOR_SOURCES).toContain("public/models/face_landmarker.task");
    expect(DETECTOR_SOURCES).toContain("src/io/landmarker.ts");
  });
});

describe("the instrument that drove the corpus", () => {
  // Roadmap 10.1g's provenance half. The card pinned the model, the
  // runtime and the landmarker options, and said nothing about the
  // browser. Every published Eyeblink8 number was produced by stepping
  // real clips in a real browser, launched by Playwright from
  // tools/measure_corpus.mjs, and a Playwright bump changes both the
  // driver and the browser binary underneath it without one line of
  // this repository changing. Row 10.1g4 put package-lock.json under
  // the detector ratchet for that reason; this is the other half, so
  // the card says WHICH browser rather than leaving a reader to guess.

  it("names the engine the corpus runner actually launches", () => {
    expect(
      runnerEngine(
        'import { webkit } from "@playwright/test";\nwebkit.launch();',
      ),
    ).toBe("webkit");
  });

  it("refuses a runner that launches an engine it did not import", () => {
    // A source that imports one engine and launches another is not a
    // source this parser may guess about. Reporting either name would
    // put a browser in the card that never ran.
    expect(() =>
      runnerEngine(
        'import { webkit } from "@playwright/test";\nchromium.launch();',
      ),
    ).toThrow(/launches/);
  });

  it("refuses a runner that launches more than one engine", () => {
    expect(() =>
      runnerEngine(
        'import { webkit, chromium } from "@playwright/test";\nwebkit.launch();\nchromium.launch();',
      ),
    ).toThrow(/launches/);
  });

  it("refuses a runner that launches nothing", () => {
    expect(() => runnerEngine("const x = 1;")).toThrow(/launches/);
  });

  it("reads the Playwright version from the lockfile, not from a comment", () => {
    const pinned = lockfilePlaywright(root);
    expect(pinned.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reads the browser versions Playwright bundles", () => {
    const bundled = bundledBrowsers(root);
    expect(bundled.webkit).toMatch(/^\d+/);
    expect(bundled.chromium).toMatch(/^\d+\./);
  });

  it("returns null when the card has no instrument section", () => {
    expect(cardInstrument("## Privacy\n\nwords")).toBeNull();
  });

  it("the card names the engine the runner launches", () => {
    const runner = readRepoFile("tools/measure_corpus.mjs", root);
    expect(cardInstrument(card)?.engine).toBe(runnerEngine(runner));
  });

  it("the card states the Playwright version the lockfile pins", () => {
    expect(cardInstrument(card)?.playwrightVersion).toBe(
      lockfilePlaywright(root).version,
    );
  });

  it("the card states the browser versions that Playwright bundles", () => {
    const bundled = bundledBrowsers(root);
    expect(cardInstrument(card)?.webkitVersion).toBe(bundled.webkit);
    expect(cardInstrument(card)?.chromiumVersion).toBe(bundled.chromium);
  });

  it("keeps package-lock.json under the detector ratchet, which is what makes these lines matter", () => {
    // Without the ratchet these pins only say the card is current.
    // With it, a Playwright bump reddens twice: the card must be
    // updated, and the bump must be declared against the published
    // numbers or re-measured.
    expect(DETECTOR_SOURCES).toContain("package-lock.json");
  });
});

describe("Playwright arrives as its own pull request", () => {
  // A bump that can move a published measurement must not arrive
  // bundled with nine others under one grouped title. Roadmap 10.1g.
  const dependabot = readRepoFile(".github/dependabot.yml", root);

  it("excludes Playwright from the grouped minor and patch updates", () => {
    expect(groupedExclusions(dependabot)).toContain("@playwright/test");
    expect(groupedExclusions(dependabot)).toContain("playwright");
  });
});
