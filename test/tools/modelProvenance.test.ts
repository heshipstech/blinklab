import { describe, expect, it } from "vitest";

import {
  cardProvenance,
  landmarkerOptions,
  lockfileVision,
  modelHash,
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
