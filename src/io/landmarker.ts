import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Both the WASM runtime and the model file are served from our own
// origin. The running app never contacts a third party server.
export async function loadLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(
    `${import.meta.env.BASE_URL}mediapipe-wasm`,
  );
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
  });
}
