import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

import type { LandmarkerDelegate } from "../core/delegateTruth";
import { cachedModelBytes } from "./modelCache";

// Both the WASM runtime and the model file are served from our own
// origin. The running app never contacts a third party server.

/** What loading actually did, beside what it produced (roadmap 13.5). */
export type LandmarkerLoad = {
  landmarker: FaceLandmarker;
  /** The delegate of the load that succeeded. A request, never an
   * observation: the vendored API does not report what executed. */
  requestedDelegate: LandmarkerDelegate;
  /** True when the GPU load rejected and the one CPU retry ran. */
  gpuLoadRejected: boolean;
};

// The options are spelled out twice below on purpose. MODEL_CARD.md's
// provenance section is held to these literals by
// tools/modelProvenance.mjs, and a shared helper taking the delegate
// as a parameter is exactly what hides them from that pin — the guard
// read null the moment the first draft of this retry factored them
// out. The FIRST delegate literal is the primary request, which is
// what the card's configuration block states.

export async function loadLandmarker(): Promise<LandmarkerLoad> {
  const fileset = await FilesetResolver.forVisionTasks(
    `${import.meta.env.BASE_URL}mediapipe-wasm`,
  );
  // The model as bytes from the Cache API when it can be had that way
  // (roadmap 13.10), the same-origin URL when it cannot: identical
  // bytes either road, from this page's own origin, so which road ran
  // changes no measurement — only what a returning visitor re-pays.
  const modelUrl = `${import.meta.env.BASE_URL}models/face_landmarker.task`;
  const modelBytes = await cachedModelBytes(modelUrl);
  const model =
    modelBytes === null
      ? { modelAssetPath: modelUrl }
      : { modelAssetBuffer: modelBytes };
  try {
    return {
      landmarker: await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          ...model,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      }),
      requestedDelegate: "GPU",
      gpuLoadRejected: false,
    };
  } catch {
    // One retry, as CPU, roadmap 13.5. A machine whose GPU delegate
    // cannot even LOAD used to lose the whole session to modelFailed;
    // the CPU path measures the same eyes more slowly, and the export
    // records which request actually loaded, so no reader mistakes
    // the retried session for the ordinary one.
    return {
      landmarker: await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          ...model,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      }),
      requestedDelegate: "CPU",
      gpuLoadRejected: true,
    };
  }
}
