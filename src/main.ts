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
  BLINK_APERTURE_THRESHOLD_MM,
  LEFT_EYE_EAR_INDICES,
  LEFT_EYE_INDICES,
  LEFT_IRIS_CENTER_INDEX,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_EYE_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
  RIGHT_IRIS_RING_INDICES,
} from "./core/constants";
import { apertureMm, aperturePx } from "./core/aperture";
import {
  baselineStep,
  learningSecondsLeft,
  personalThresholdMm,
  startBaseline,
  type BaselineState,
} from "./core/baseline";
import { blinkStep, initialBlinkState } from "./core/blink";
import {
  gatedBlinkRatePerMin,
  recordBlink,
  startRate,
  type BlinkRateState,
} from "./core/blinkRate";
import { fpsGateMessage, measurableAtFps } from "./core/fpsGate";
import { irisOffset } from "./core/gazeOffset";
import { meanIrisOffset, screenQuadrant } from "./core/gazeQuadrant";
import {
  appendEvent,
  formatBlinkEvent,
  type BlinkEvent,
} from "./core/blinkLog";
import { analyzeClosing } from "./core/blinkShape";
import { eyeAspectRatio, eyeLandmarksFromFace } from "./core/ear";
import { eulerFromMatrix } from "./core/headPose";
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
import { pushBounded } from "./core/ringBuffer";
import { sparklineSegments, type EarSample } from "./core/sparkline";
import { coefficientOfVariation } from "./core/statistics";
import { inferenceMessage, meanDurationMs, pushSample } from "./core/timing";
import { poseValidity, poseValidityMessage } from "./core/validityGate";
import { frameTransform } from "./core/transform";
import { displaySize } from "./core/videoLayout";
import { listMediaDevices, startCamera, stopCamera } from "./io/camera";
import { downloadTextFile } from "./io/download";
import { startFrameLoop } from "./io/frameLoop";
import { loadLandmarker } from "./io/landmarker";
import {
  drawDots,
  drawPolyline,
  drawRing,
  drawVideoFrame,
} from "./io/videoCanvas";
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
  apertureLabel.hidden = state.kind !== "running";
  stabilityLabel.hidden = state.kind !== "running";
  headPoseLabel.hidden = state.kind !== "running";
  gazeLabel.hidden = state.kind !== "running";
  quadrantLabel.hidden = state.kind !== "running";
  gateLabel.hidden = state.kind !== "running";
  blinkLabel.hidden = state.kind !== "running";
  baselineLabel.hidden = state.kind !== "running";
  blinkShapeLabel.hidden = state.kind !== "running";
  blinkLogList.hidden = state.kind !== "running";
  sparkCanvas.hidden = state.kind !== "running";
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
    // A fresh camera start restarts the baseline and the rate window:
    // light, distance and even the person may have changed.
    baselineState = null;
    rateState = null;
    blinkEvents = [];
    sessionStartMs = null;
    blinkLogList.replaceChildren();
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
const apertureLabel = document.createElement("p");
apertureLabel.hidden = true;

// The lean in, lean out experiment, live: both apertures' coefficient
// of variation over the last 10 seconds, side by side.
const stabilityLabel = document.createElement("p");
stabilityLabel.hidden = true;
const headPoseLabel = document.createElement("p");
headPoseLabel.hidden = true;
const gazeLabel = document.createElement("p");
gazeLabel.hidden = true;
const quadrantLabel = document.createElement("p");
quadrantLabel.hidden = true;

// Speaks only while the pose gate is refusing. Empty otherwise.
const gateLabel = document.createElement("p");
gateLabel.hidden = true;

const blinkLabel = document.createElement("p");
blinkLabel.hidden = true;
let blinkState = initialBlinkState;

const baselineLabel = document.createElement("p");
baselineLabel.hidden = true;
let baselineState: BaselineState | null = null;
let rateState: BlinkRateState | null = null;

const blinkShapeLabel = document.createElement("p");
blinkShapeLabel.hidden = true;

// The blink event log: newest on top, capped, scrolls.
const blinkLogList = document.createElement("ul");
blinkLogList.setAttribute("aria-label", "Blink events");
blinkLogList.style.maxHeight = "160px";
blinkLogList.style.overflowY = "auto";
blinkLogList.hidden = true;
let blinkEvents: BlinkEvent[] = [];
let sessionStartMs: number | null = null;
type StabilitySample = {
  timestampMs: number;
  px: number | null;
  mm: number | null;
};
let stabilitySamples: StabilitySample[] = [];

// The rolling EAR sparkline: 10 seconds, fixed scale, gaps are gaps.
const SPARK_WINDOW_MS = 10000;
const SPARK_EAR_MAX = 0.6;
const sparkCanvas = document.createElement("canvas");
sparkCanvas.width = 640;
sparkCanvas.height = 80;
sparkCanvas.hidden = true;
sparkCanvas.setAttribute(
  "aria-label",
  "Eye aspect ratio over the last 10 seconds",
);
const sparkContext = sparkCanvas.getContext("2d");
let earSamples: EarSample[] = [];

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

      let meanEar: number | null = null;
      let stabilityPx: number | null = null;
      let stabilityMm: number | null = null;
      const face = result.faceLandmarks[0];
      if (face !== undefined) {
        const validation = validateLandmarkCount(face.length);
        modelStatus.textContent = landmarkValidationMessage(validation);
        if (validation.kind !== "valid") {
          return;
        }

        recorder?.captureFrame(nowMs, face);

        const matrixData = result.facialTransformationMatrixes[0]?.data;
        const pose =
          matrixData === undefined ? null : eulerFromMatrix(matrixData);
        headPoseLabel.textContent =
          pose === null
            ? "Head pose: no valid measurement"
            : `Head pose, pitch: ${pose.pitchDeg.toFixed(0)}°, yaw: ${pose.yawDeg.toFixed(0)}°, roll: ${pose.rollDeg.toFixed(0)}°`;
        const gate = poseValidity(pose);
        gateLabel.textContent = poseValidityMessage(gate);

        if (gate.kind === "valid") {
          const rightEye = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
          const leftEye = eyeLandmarksFromFace(face, LEFT_EYE_EAR_INDICES);
          const rightEar = rightEye === null ? null : eyeAspectRatio(rightEye);
          const leftEar = leftEye === null ? null : eyeAspectRatio(leftEye);
          earLabel.textContent =
            rightEar === null || leftEar === null
              ? "Eye aspect ratio: no valid measurement"
              : `Eye aspect ratio, right: ${rightEar.toFixed(2)}, left: ${leftEar.toFixed(2)}`;
          meanEar =
            rightEar === null || leftEar === null
              ? null
              : (rightEar + leftEar) / 2;

          const rightMm = apertureMm(
            face,
            RIGHT_EYE_EAR_INDICES,
            RIGHT_IRIS_RING_INDICES,
            canvas.width,
            canvas.height,
          );
          const leftMm = apertureMm(
            face,
            LEFT_EYE_EAR_INDICES,
            LEFT_IRIS_RING_INDICES,
            canvas.width,
            canvas.height,
          );
          apertureLabel.textContent =
            rightMm === null || leftMm === null
              ? "Eyelid aperture: no valid measurement"
              : `Eyelid aperture, right: ${rightMm.toFixed(1)} mm, left: ${leftMm.toFixed(1)} mm`;

          const rightPx = aperturePx(
            face,
            RIGHT_EYE_EAR_INDICES,
            canvas.width,
            canvas.height,
          );
          const leftPx = aperturePx(
            face,
            LEFT_EYE_EAR_INDICES,
            canvas.width,
            canvas.height,
          );
          stabilityPx =
            rightPx === null || leftPx === null ? null : (rightPx + leftPx) / 2;
          stabilityMm =
            rightMm === null || leftMm === null ? null : (rightMm + leftMm) / 2;

          const rightOffset = irisOffset(
            face,
            RIGHT_EYE_EAR_INDICES,
            RIGHT_IRIS_CENTER_INDEX,
            "right",
            canvas.width,
            canvas.height,
          );
          const leftOffset = irisOffset(
            face,
            LEFT_EYE_EAR_INDICES,
            LEFT_IRIS_CENTER_INDEX,
            "left",
            canvas.width,
            canvas.height,
          );
          const fmt = (v: number) =>
            v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
          gazeLabel.textContent =
            rightOffset === null || leftOffset === null
              ? "Iris offset: no valid measurement"
              : `Iris offset, right: ${fmt(rightOffset.horizontal)} / ${fmt(rightOffset.vertical)}, left: ${fmt(leftOffset.horizontal)} / ${fmt(leftOffset.vertical)}`;

          const meanOffset = meanIrisOffset(rightOffset, leftOffset);
          quadrantLabel.textContent =
            meanOffset === null
              ? "Looking toward: no valid measurement"
              : `Looking toward: ${screenQuadrant(meanOffset)} (uncalibrated)`;
        } else {
          // The gate refused: numbers pause, the gap is honest, the
          // pose stays visible so you can see your way back.
          earLabel.textContent = "Eye aspect ratio: no valid measurement";
          apertureLabel.textContent = "Eyelid aperture: no valid measurement";
          gazeLabel.textContent = "Iris offset: no valid measurement";
          quadrantLabel.textContent = "Looking toward: no valid measurement";
        }

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
      } else {
        // No face: the numbers must vanish, not go stale.
        earLabel.textContent = "Eye aspect ratio: no valid measurement";
        apertureLabel.textContent = "Eyelid aperture: no valid measurement";
        headPoseLabel.textContent = "Head pose: no valid measurement";
        gazeLabel.textContent = "Iris offset: no valid measurement";
        quadrantLabel.textContent = "Looking toward: no valid measurement";
        gateLabel.textContent = "";
      }

      earSamples = pushBounded(
        earSamples,
        { timestampMs: nowMs, ear: meanEar },
        1200,
      );

      baselineState = baselineStep(
        baselineState ?? startBaseline(nowMs),
        nowMs,
        stabilityMm,
      );
      const personalMm = personalThresholdMm(baselineState);
      const secondsLeft = learningSecondsLeft(baselineState, nowMs);
      baselineLabel.textContent =
        baselineState.kind === "ready" && personalMm !== null
          ? `Personal blink threshold: ${personalMm.toFixed(1)} mm (half of your ${baselineState.baselineMm.toFixed(1)} mm baseline)`
          : `Learning your open eyes: ${String(secondsLeft ?? 0)} s left`;

      const blinkCountBefore = blinkState.blinkCount;
      const blinkMeasurable = measurableAtFps(fps);
      blinkState = blinkStep(
        blinkState,
        nowMs,
        blinkMeasurable ? stabilityMm : null,
        personalMm ?? BLINK_APERTURE_THRESHOLD_MM,
      );
      rateState ??= startRate(nowMs);
      if (blinkState.blinkCount > blinkCountBefore) {
        rateState = recordBlink(rateState, nowMs);

        // Analyse the descent that just ended: the closure plus a
        // little lead in, from the rolling aperture history.
        const closureStartMs =
          nowMs - (blinkState.lastBlinkDurationMs ?? 0) - 400;
        const window = stabilitySamples
          .filter(
            (sample) =>
              sample.timestampMs >= closureStartMs && sample.mm !== null,
          )
          .map((sample) => ({
            timestampMs: sample.timestampMs,
            apertureMm: sample.mm ?? 0,
          }));
        const shape = analyzeClosing(window);
        if (shape !== null) {
          blinkShapeLabel.textContent = `Last blink shape: amplitude ${shape.amplitudeMm.toFixed(1)} mm, peak closing ${shape.peakClosingVelocityMmPerS.toFixed(0)} mm/s, A/V ${shape.amplitudeOverVelocityMs.toFixed(0)} ms`;
        }

        sessionStartMs ??= nowMs;
        blinkEvents = appendEvent(blinkEvents, {
          atMs: nowMs,
          durationMs: blinkState.lastBlinkDurationMs ?? 0,
          shape,
        });
        blinkLogList.replaceChildren(
          ...[...blinkEvents].reverse().map((event) => {
            const item = document.createElement("li");
            item.textContent = formatBlinkEvent(event, sessionStartMs ?? 0);
            return item;
          }),
        );
      }
      if (!blinkMeasurable) {
        blinkLabel.textContent = fpsGateMessage(fps);
      } else {
        const ratePerMin = gatedBlinkRatePerMin(fps, rateState, nowMs);
        const parts = [`Blinks: ${String(blinkState.blinkCount)}`];
        if (blinkState.lastBlinkDurationMs !== null) {
          parts.push(`last: ${blinkState.lastBlinkDurationMs.toFixed(0)} ms`);
        }
        parts.push(
          ratePerMin === null
            ? "rate: measuring..."
            : `rate: ${ratePerMin.toFixed(0)}/min`,
        );
        blinkLabel.textContent = `${parts[0] ?? ""} (${parts.slice(1).join(", ")})`;
      }

      stabilitySamples = pushBounded(
        stabilitySamples,
        { timestampMs: nowMs, px: stabilityPx, mm: stabilityMm },
        1200,
      ).filter((sample) => nowMs - sample.timestampMs <= SPARK_WINDOW_MS);
      const pxSeries = stabilitySamples
        .map((sample) => sample.px)
        .filter((value): value is number => value !== null);
      const mmSeries = stabilitySamples
        .map((sample) => sample.mm)
        .filter((value): value is number => value !== null);
      const cvPx = coefficientOfVariation(pxSeries);
      const cvMm = coefficientOfVariation(mmSeries);
      stabilityLabel.textContent =
        cvPx === null || cvMm === null
          ? "Aperture stability: measuring..."
          : `Aperture stability over 10 s, px CV: ${(cvPx * 100).toFixed(1)}%, mm CV: ${(cvMm * 100).toFixed(1)}%`;
      if (sparkContext !== null) {
        sparkContext.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
        for (const segment of sparklineSegments(
          earSamples,
          nowMs,
          SPARK_WINDOW_MS,
          sparkCanvas.width,
          sparkCanvas.height,
          SPARK_EAR_MAX,
        )) {
          drawPolyline(sparkContext, segment, 1.5, "#00b0ff");
        }
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
  apertureLabel,
  stabilityLabel,
  headPoseLabel,
  gazeLabel,
  quadrantLabel,
  gateLabel,
  blinkLabel,
  baselineLabel,
  blinkShapeLabel,
  sparkCanvas,
  blinkLogList,
  ...(recorder !== null ? [recorder.button] : []),
);
render();
