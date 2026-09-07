// Types for the plain JavaScript provenance tool next door. Same
// arrangement as the other guards: the tool stays .mjs because it
// reads the disk, and its callers are type checked.

export const MODEL_PATH: string;
export const LANDMARKER: string;

/** The sha256 of the committed model file, as lowercase hex. */
export function modelHash(root: string): string;

/** The vendored vision runtime as the lockfile pins it. */
export function lockfileVision(root: string): {
  version: string;
  integrity: string;
};

/** The landmarker options as a source (or card) text sets them. */
export type LandmarkerOptions = {
  delegate: string | null;
  runningMode: string | null;
  numFaces: number | null;
  outputFacialTransformationMatrixes: boolean;
  outputFaceBlendshapes: boolean;
};
export function landmarkerOptions(sourceText: string): LandmarkerOptions;

/** What MODEL_CARD's provenance section states, or null when absent. */
export function cardProvenance(cardText: string): {
  modelSha256: string | null;
  packageVersion: string | null;
  integrityPrefix: string | null;
  delegate: string | null;
  runningMode: string | null;
  numFaces: number | null;
  outputFacialTransformationMatrixes: boolean;
  outputFaceBlendshapes: boolean;
} | null;

export const RUNNER: string;
export const DEPENDABOT: string;
export const BROWSERS_JSON: string;

/**
 * The one Playwright engine the corpus runner launches. Throws rather
 * than guessing when the source launches none, two, or one it never
 * imported.
 */
export function runnerEngine(sourceText: string): string;

/** The Playwright driver as the lockfile pins it. */
export function lockfilePlaywright(root: string): {
  version: string;
  integrity: string;
};

/** The browser versions the pinned Playwright ships with. */
export function bundledBrowsers(root: string): {
  chromium: string;
  webkit: string;
};

/** What MODEL_CARD's instrument section states, or null when absent. */
export function cardInstrument(cardText: string): {
  engine: string | null;
  playwrightVersion: string | null;
  webkitVersion: string | null;
  chromiumVersion: string | null;
} | null;

/** Dependency names Dependabot's grouped updates leave out. */
export function groupedExclusions(dependabotText: string): string[];
