import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Roadmap 10.2. The corpus numbers were produced by one model file,
// one runtime package, and one set of landmarker options. Swap any of
// the three and the published figures describe an instrument that no
// longer exists — which is precisely the shape of the blendshape work
// coming in 12.2, so the tripwire is installed before the change that
// needs it. MODEL_CARD states all three; the test recomputes them from
// the committed artifacts and reddens on any mismatch. Same
// arrangement as the other guards: plain .mjs reading the disk, data
// out, callers type checked.

const MODEL_PATH = "public/models/face_landmarker.task";
const LOCKFILE = "package-lock.json";
const LANDMARKER = "src/io/landmarker.ts";
export { LANDMARKER, MODEL_PATH };

/** The sha256 of the committed model file, as lowercase hex. */
export function modelHash(root) {
  const bytes = readFileSync(join(root, MODEL_PATH));
  return createHash("sha256").update(bytes).digest("hex");
}

/** The vendored vision runtime as the lockfile pins it. */
export function lockfileVision(root) {
  const lock = JSON.parse(readFileSync(join(root, LOCKFILE), "utf8"));
  const entry = lock.packages["node_modules/@mediapipe/tasks-vision"];
  return { version: entry.version, integrity: entry.integrity };
}

/**
 * The landmarker options as the source text sets them. An absent
 * outputFaceBlendshapes is reported as false, never as unknown: the
 * library's default is off, and "unknown" would let the card stay
 * silent about a head the app does not run.
 */
export function landmarkerOptions(sourceText) {
  const string = (name) => {
    const match = sourceText.match(new RegExp(`${name}:\\s*"([^"]+)"`));
    return match === null ? null : match[1];
  };
  const flag = (name) => {
    const match = sourceText.match(new RegExp(`${name}:\\s*(true|false)`));
    return match === null ? null : match[1] === "true";
  };
  const numFaces = sourceText.match(/numFaces:\s*(\d+)/);
  return {
    delegate: string("delegate"),
    runningMode: string("runningMode"),
    numFaces: numFaces === null ? null : Number(numFaces[1]),
    outputFacialTransformationMatrixes:
      flag("outputFacialTransformationMatrixes") ?? false,
    outputFaceBlendshapes: flag("outputFaceBlendshapes") ?? false,
  };
}

/**
 * What MODEL_CARD's "## Model provenance" section states, or null when
 * the section is missing. Parsing failures inside a present section
 * surface as nulls in the fields, which the tests then fail on by
 * name — a half-written section must not pass as a whole one.
 */
export function cardProvenance(cardText) {
  const section = cardText.match(/## Model provenance\n([\s\S]*?)(?=\n## |$)/);
  if (section === null) {
    return null;
  }
  const text = section[1];
  const sha = text.match(/sha256\s+`([0-9a-f]{64})`/);
  const version = text.match(/tasks-vision `([^`]+)`/);
  const integrity = text.match(/integrity `([^`]+)`/);
  const options = landmarkerOptions(text);
  return {
    modelSha256: sha === null ? null : sha[1],
    packageVersion: version === null ? null : version[1],
    integrityPrefix: integrity === null ? null : integrity[1],
    delegate: options.delegate,
    runningMode: options.runningMode,
    numFaces: options.numFaces,
    outputFacialTransformationMatrixes:
      options.outputFacialTransformationMatrixes,
    outputFaceBlendshapes: options.outputFaceBlendshapes,
  };
}

// Roadmap 10.1g's provenance half. The card pinned the model, the
// runtime and the landmarker options, and said nothing about the
// browser. Every published Eyeblink8 number was produced by stepping
// real clips in a real browser that Playwright launched, and a
// Playwright bump moves both the driver and the browser binary
// underneath it without one line of this repository changing.

const RUNNER = "tools/measure_corpus.mjs";
const DEPENDABOT = ".github/dependabot.yml";
const BROWSERS_JSON = "node_modules/playwright-core/browsers.json";
export { BROWSERS_JSON, DEPENDABOT, RUNNER };

/**
 * The one Playwright engine the corpus runner launches.
 *
 * Refuses rather than guesses. A source that launches nothing, or two
 * engines, or one it never imported, would put a browser name in the
 * card that no measurement ever ran in, and a card that names the
 * wrong browser is worse than one that names none.
 */
export function runnerEngine(sourceText) {
  const imported = new Set();
  for (const line of sourceText.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*"@playwright\/test"/g,
  )) {
    for (const name of line[1].split(",")) {
      const trimmed = name.trim();
      if (trimmed !== "") imported.add(trimmed);
    }
  }
  const launched = new Set();
  for (const call of sourceText.matchAll(/\b(\w+)\.launch\s*\(/g)) {
    launched.add(call[1]);
  }
  const both = [...launched].filter((name) => imported.has(name));
  if (both.length !== 1) {
    throw new Error(
      `${RUNNER}: launches ${both.length} engines imported from ` +
        `@playwright/test (imported ${[...imported].join(", ") || "none"}; ` +
        `launched ${[...launched].join(", ") || "none"}), and the card may ` +
        "not name a browser this parser had to guess",
    );
  }
  return both[0];
}

/** The Playwright driver as the lockfile pins it. */
export function lockfilePlaywright(root) {
  const lock = JSON.parse(readFileSync(join(root, LOCKFILE), "utf8"));
  const entry = lock.packages["node_modules/@playwright/test"];
  return { version: entry.version, integrity: entry.integrity };
}

/**
 * The browser versions the pinned Playwright ships with, read from the
 * manifest inside playwright-core rather than by launching anything.
 * The lockfile pins playwright-core, so this file is a function of the
 * lockfile and reads the same on every machine that installed from it.
 */
export function bundledBrowsers(root) {
  const manifest = JSON.parse(readFileSync(join(root, BROWSERS_JSON), "utf8"));
  const version = (name) => {
    const entry = manifest.browsers.find((browser) => browser.name === name);
    if (entry === undefined || typeof entry.browserVersion !== "string") {
      throw new Error(
        `${BROWSERS_JSON}: no browserVersion for ${name}, so the card ` +
          "cannot state which binary stepped the corpus",
      );
    }
    return entry.browserVersion;
  };
  return { chromium: version("chromium"), webkit: version("webkit") };
}

/**
 * What MODEL_CARD's "## The instrument that stepped the corpus"
 * section states, or null when the section is missing. As with
 * cardProvenance, a half-written section surfaces as nulls that the
 * tests fail on by name rather than passing as a whole one.
 */
export function cardInstrument(cardText) {
  const section = cardText.match(
    /## The instrument that stepped the corpus\n([\s\S]*?)(?=\n## |$)/,
  );
  if (section === null) {
    return null;
  }
  const text = section[1];
  const one = (pattern) => {
    const match = text.match(pattern);
    return match === null ? null : match[1];
  };
  // The card is hard-wrapped prose, so a name and the value it
  // introduces can fall on either side of a line break. Matching only
  // a space would make the pin depend on where the paragraph happened
  // to wrap, which is a guard that fails for the wrong reason.
  return {
    engine: one(/launches\s+`([a-z]+)`/),
    playwrightVersion: one(/@playwright\/test\s+`([^`]+)`/),
    webkitVersion: one(/WebKit\s+`([^`]+)`/),
    chromiumVersion: one(/Chromium\s+`([^`]+)`/),
  };
}

/**
 * The dependency names Dependabot's grouped minor-and-patch updates
 * exclude, so a bump that can move a published measurement arrives as
 * its own pull request rather than under one grouped title with nine
 * others.
 */
export function groupedExclusions(dependabotText) {
  const group = dependabotText.match(
    /exclude-patterns:\n((?:\s*-\s*"[^"]+"\n)+)/,
  );
  if (group === null) {
    return [];
  }
  return [...group[1].matchAll(/-\s*"([^"]+)"/g)].map((match) => match[1]);
}
