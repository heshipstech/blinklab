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
