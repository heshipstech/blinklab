import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

import type { LandmarkerDelegate } from "../core/delegateTruth";

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

async function createWith(
  fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  delegate: LandmarkerDelegate,
): Promise<FaceLandmarker> {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
      delegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
  });
}

export async function loadLandmarker(): Promise<LandmarkerLoad> {
  const fileset = await FilesetResolver.forVisionTasks(
    `${import.meta.env.BASE_URL}mediapipe-wasm`,
  );
  try {
    return {
      landmarker: await createWith(fileset, "GPU"),
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
      landmarker: await createWith(fileset, "CPU"),
      requestedDelegate: "CPU",
      gpuLoadRejected: true,
    };
  }
}
