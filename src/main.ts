import {
  cameraStateMessage,
  classifyCameraError,
  type CameraState,
} from "./core/cameraState";
import {
  cameraOptions,
  shouldShowPicker,
  type CameraOption,
} from "./core/deviceList";
import {
  LEFT_EYE_EAR_INDICES,
  LEFT_EYE_INDICES,
  LEFT_IRIS_CENTER_INDEX,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_EYE_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
  RIGHT_IRIS_RING_INDICES,
} from "./core/constants";
import { eyeAspectRatio, eyeLandmarksFromFace } from "./core/ear";
import { isFacePresent } from "./core/facePresence";
import {
  addFrame,
  isComplete,
  serializeFixture,
  startRecording,
  type RecordingState,
} from "./core/fixtureRecording";
import { keepRecent, measureFps } from "./core/fps";
import {
  landmarkValidationMessage,
  validateLandmarkCount,
} from "./core/landmarkGuard";
import { pickPoints } from "./core/landmarks";
import { projectNormalizedPoint } from "./core/projection";
import { inferenceMessage, meanDurationMs, pushSample } from "./core/timing";
import { frameTransform } from "./core/transform";
import { displaySize } from "./core/videoLayout";
import { listMediaDevices, startCamera, stopCamera } from "./io/camera";
import { downloadTextFile } from "./io/download";
import { startFrameLoop } from "./io/frameLoop";
import { loadLandmarker } from "./io/landmarker";
import { drawDots, drawRing, drawVideoFrame } from "./io/videoCanvas";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error('index.html must contain an element with id "app"');
}

const title = document.createElement("h1");
title.textContent = "blinklab";

const startButton = document.createElement("button");
startButton.textContent = "Start camera";

// Hidden until we know the machine has more than one camera.
const picker = document.createElement("select");
picker.setAttribute("aria-label", "Camera");
picker.hidden = true;

function populatePicker(
  options: readonly CameraOption[],
  selectedId?: string,
): void {
  picker.replaceChildren(
    ...options.map((option) => {
      const item = document.createElement("option");
      item.value = option.deviceId;
      item.textContent = option.label;
      return item;
    }),
  );
  if (selectedId !== undefined) {
    picker.value = selectedId;
  }
}

// The video element is only a source now. It never joins the page,
// the canvas below shows what we draw from it each frame.
const video = document.createElement("video");
video.playsInline = true;
video.muted = true;

const canvas = document.createElement("canvas");
let canvasContext: CanvasRenderingContext2D | null = null;

// People expect to see themselves as a mirror shows them.
let mirrored = true;

const mirrorLabel = document.createElement("label");
const mirrorToggle = document.createElement("input");
mirrorToggle.type = "checkbox";
mirrorToggle.checked = mirrored;
mirrorToggle.addEventListener("change", () => {
  mirrored = mirrorToggle.checked;
});
mirrorLabel.append(mirrorToggle, " Mirror");
mirrorLabel.hidden = true;

const resolutionLabel = document.createElement("p");
resolutionLabel.hidden = true;

// Speaks only when the model breaks its contract. Empty otherwise.
const modelStatus = document.createElement("p");

// Development tool only: records landmark frames into a test fixture.
// Creation itself is gated on import.meta.env.DEV, which is false in
// production builds, so dead code elimination removes the recorder
// entirely. Hidden is not absent, only absent is absent.
const RECORD_TARGET_FRAMES = 300;

type Recorder = {
  button: HTMLButtonElement;
  captureFrame: (
    nowMs: number,
    face: readonly { x: number; y: number; z: number }[],
  ) => void;
};

function createRecorder(): Recorder {
  const button = document.createElement("button");
  button.textContent = "Record fixture";
  button.hidden = true;
  let recording: RecordingState | null = null;

  button.addEventListener("click", () => {
    recording = startRecording(RECORD_TARGET_FRAMES);
    button.disabled = true;
  });

  return {
    button,
    captureFrame: (nowMs, face) => {
      if (recording === null) {
        return;
      }
      recording = addFrame(recording, {
        timestampMs: nowMs,
        landmarks: face.map((l) => ({ x: l.x, y: l.y, z: l.z })),
      });
      button.textContent = `Recording ${String(recording.frames.length)}/${String(RECORD_TARGET_FRAMES)}...`;
      if (isComplete(recording)) {
        downloadTextFile("session-01.json", serializeFixture(recording));
        recording = null;
        button.disabled = false;
        button.textContent = "Record fixture";
      }
    },
  };
}

const recorder = import.meta.env.DEV ? createRecorder() : null;

const status = document.createElement("p");

let state: CameraState = { kind: "idle" };

function render(): void {
  status.textContent = cameraStateMessage(state);
  canvas.hidden = state.kind !== "running";
  mirrorLabel.hidden = state.kind !== "running";
  resolutionLabel.hidden = state.kind !== "running";
  inferenceLabel.hidden = state.kind !== "running";
  earLabel.hidden = state.kind !== "running";
  if (recorder !== null) {
    recorder.button.hidden = state.kind !== "running";
  }
  startButton.hidden = state.kind === "running" || state.kind === "requesting";
}

function setState(next: CameraState): void {
  state = next;
  render();
}

async function beginCamera(deviceId?: string): Promise<void> {
  setState({ kind: "requesting" });
  stopCamera(video);
  try {
    const frame = await startCamera(video, deviceId);
    const display = displaySize(frame.widthPx, frame.heightPx, 640);
    if (display !== null) {
      canvas.width = display.width;
      canvas.height = display.height;
    }
    canvasContext = canvas.getContext("2d");
    resolutionLabel.textContent = `Camera resolution: ${String(frame.widthPx)} x ${String(frame.heightPx)} pixels`;
    setState({ kind: "running" });
    void ensureLandmarker();
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : String(error);
    setState(classifyCameraError(name));
    return;
  }
  try {
    const options = cameraOptions(await listMediaDevices());
    if (shouldShowPicker(options)) {
      populatePicker(options, deviceId);
      picker.hidden = false;
    }
  } catch {
    // Device listing failed. The camera still runs, the picker stays hidden.
  }
}

let landmarker: FaceLandmarker | null = null;
let landmarkerLoading = false;
let lastFacePresent: boolean | null = null;

async function ensureLandmarker(): Promise<void> {
  if (landmarker !== null || landmarkerLoading) {
    return;
  }
  landmarkerLoading = true;
  try {
    landmarker = await loadLandmarker();
  } catch (error: unknown) {
    // Full degraded-state treatment for a failed model load is 2.5 territory.
    console.error("face landmarker failed to load:", error);
  } finally {
    landmarkerLoading = false;
  }
}

startButton.addEventListener("click", () => {
  void beginCamera();
});

picker.addEventListener("change", () => {
  void beginCamera(picker.value);
});

const fpsLabel = document.createElement("p");
const inferenceLabel = document.createElement("p");
inferenceLabel.hidden = true;
const earLabel = document.createElement("p");
earLabel.hidden = true;

let frameTimestampsMs: number[] = [];
let inferenceSamplesMs: number[] = [];

startFrameLoop((nowMs) => {
  frameTimestampsMs.push(nowMs);
  frameTimestampsMs = keepRecent(frameTimestampsMs, nowMs, 2000);
  const fps = measureFps(frameTimestampsMs);
  fpsLabel.textContent =
    fps === null
      ? "Frames per second: measuring..."
      : `Frames per second: ${String(Math.round(fps))}`;

  if (state.kind === "running" && canvasContext !== null) {
    const transform = frameTransform(mirrored, canvas.width);
    drawVideoFrame(canvasContext, video, transform);

    if (landmarker !== null) {
      const inferenceStartMs = performance.now();
      const result = landmarker.detectForVideo(video, nowMs);
      inferenceSamplesMs = pushSample(
        inferenceSamplesMs,
        performance.now() - inferenceStartMs,
        60,
      );
      inferenceLabel.textContent = inferenceMessage(
        meanDurationMs(inferenceSamplesMs),
      );

      const present = isFacePresent(result);
      if (present !== lastFacePresent) {
        console.log("face detected:", present);
        lastFacePresent = present;
      }

      const face = result.faceLandmarks[0];
      if (face !== undefined) {
        const validation = validateLandmarkCount(face.length);
        modelStatus.textContent = landmarkValidationMessage(validation);
        if (validation.kind !== "valid") {
          return;
        }

        recorder?.captureFrame(nowMs, face);

        const rightEye = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
        const leftEye = eyeLandmarksFromFace(face, LEFT_EYE_EAR_INDICES);
        const rightEar = rightEye === null ? null : eyeAspectRatio(rightEye);
        const leftEar = leftEye === null ? null : eyeAspectRatio(leftEye);
        earLabel.textContent =
          rightEar === null || leftEar === null
            ? "Eye aspect ratio: no valid measurement"
            : `Eye aspect ratio, right: ${rightEar.toFixed(2)}, left: ${leftEar.toFixed(2)}`;

        const project = (landmarks: readonly { x: number; y: number }[]) =>
          landmarks.map((landmark) =>
            projectNormalizedPoint(
              landmark,
              canvas.width,
              canvas.height,
              transform,
            ),
          );

        const eyelidDots = project(
          pickPoints(face, [...RIGHT_EYE_INDICES, ...LEFT_EYE_INDICES]),
        );
        drawDots(canvasContext, eyelidDots, 2, "#00e676");

        const irisColor = "#ff9100";
        for (const ring of [RIGHT_IRIS_RING_INDICES, LEFT_IRIS_RING_INDICES]) {
          drawRing(
            canvasContext,
            project(pickPoints(face, ring)),
            1.5,
            irisColor,
          );
        }
        const centers = project(
          pickPoints(face, [RIGHT_IRIS_CENTER_INDEX, LEFT_IRIS_CENTER_INDEX]),
        );
        drawDots(canvasContext, centers, 2, irisColor);
      }
    }
  }
});

app.append(
  title,
  startButton,
  picker,
  canvas,
  mirrorLabel,
  resolutionLabel,
  modelStatus,
  status,
  fpsLabel,
  inferenceLabel,
  earLabel,
  ...(recorder !== null ? [recorder.button] : []),
);
render();
