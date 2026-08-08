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
import {
  CALIBRATION_TARGETS,
  captureStep,
  isCaptureDone,
  startCapture,
  type CalibrationCapture,
} from "./core/calibrationCapture";
import {
  calibratedPoint,
  calibratedQuadrant,
  solveCalibration,
  type CalibrationProfile,
} from "./core/calibrationProfile";
import { irisOffset, type IrisOffset } from "./core/gazeOffset";
import {
  isOnScreen,
  meanIrisOffset,
  screenQuadrant,
} from "./core/gazeQuadrant";
import {
  gazeSmoothingStep,
  type GazeSmoothingState,
} from "./core/gazeSmoothing";
import {
  detectFixations,
  MIN_FIXATION_DURATION_MS,
  type GazeSample,
} from "./core/fixation";
import { fixationStats, type FixationStats } from "./core/fixationStats";
import {
  assembleFeatureRecord,
  type FeatureRecord,
} from "./core/featureRecord";
import { scoreRecords } from "./core/score";
import { serializeRecords } from "./core/csv";
import { KSS_SCALE, kssMetadataRows, type KssRating } from "./core/kss";
import { demoNoticeText } from "./core/notice";
import { formatDriver, panelSummary, topDrivers } from "./core/scorePanel";
import { accumulate, emptyGrid, normalizedCells } from "./core/heatmap";
import { alertStep, alertVisible, initialAlertState } from "./core/alert";
import {
  initialLongClosureState,
  longClosureStep,
  longClosureThresholdMm,
  ongoingClosureMs,
} from "./core/longClosure";
import { emptyPerclos, perclosStep, perclosValue } from "./core/perclos";
import { replayIndex, sliderTime } from "./core/replay";
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
import { sparklineSegments, type TimedSample } from "./core/sparkline";
import { coefficientOfVariation } from "./core/statistics";
import { inferenceMessage, meanDurationMs, pushSample } from "./core/timing";
import { poseValidity, poseValidityMessage } from "./core/validityGate";
import { frameTransform } from "./core/transform";
import { displaySize } from "./core/videoLayout";
import {
  loadCalibrationProfile,
  saveCalibrationProfile,
  saveCalibrationSamples,
} from "./io/calibrationStore";
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

// The permanent notice, 6.9. Present before the camera starts, never
// dismissible, and above everything so it cannot be scrolled past
// unseen. The score line keeps its own parenthetical: a number and
// its caveat should travel together.
const demoNotice = document.createElement("p");
demoNotice.dataset.testid = "demo-notice";
demoNotice.textContent = demoNoticeText();
Object.assign(demoNotice.style, {
  border: "2px solid #b26500",
  background: "#fff3e0",
  color: "#1a1a1a",
  padding: "10px 12px",
  margin: "0 0 12px 0",
  fontWeight: "bold",
});

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
  gazeStateLabel.hidden = state.kind !== "running";
  fixationStatsLabel.hidden = state.kind !== "running";
  calibrateButton.hidden = state.kind !== "running";
  heatmapButton.hidden = state.kind !== "running";
  replayButton.hidden = state.kind !== "running";
  gateLabel.hidden = state.kind !== "running";
  blinkLabel.hidden = state.kind !== "running";
  baselineLabel.hidden = state.kind !== "running";
  blinkShapeLabel.hidden = state.kind !== "running";
  perclosLabel.hidden = state.kind !== "running";
  longClosureLabel.hidden = state.kind !== "running";
  if (state.kind !== "running") {
    alertBanner.hidden = true;
  }
  featureLabel.hidden = state.kind !== "running";
  exportButton.hidden = state.kind !== "running";
  if (state.kind !== "running") {
    kssPanel.hidden = true;
  }
  scoreLabel.hidden = state.kind !== "running";
  panelSummaryLabel.hidden = state.kind !== "running";
  panelList.hidden = state.kind !== "running";
  blinkLogList.hidden = state.kind !== "running";
  sparkCanvas.hidden = state.kind !== "running";
  gazeTraceHorizontalCanvas.hidden = state.kind !== "running";
  gazeTraceVerticalCanvas.hidden = state.kind !== "running";
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
    gazeSmoothing = null;
    gazeTraces = emptyGazeTraces();
    gazeSamples = [];
    perclosState = emptyPerclos();
    longClosureState = initialLongClosureState;
    frozenShutBaselineMm = null;
    alertState = initialAlertState;
    featureRecords = [];
    lastRecordAtMs = null;
    exportButton.disabled = true;
    sessionStartedAtEpochMs = null;
    kssBefore = null;
    kssAfter = null;
    askKss("Before you begin: how sleepy do you feel?", (rating) => {
      kssBefore = rating;
    });
    featureLabel.textContent = "";
    scoreLabel.textContent = "";
    panelSummaryLabel.textContent = "";
    panelList.replaceChildren();
    // Review found this missing: without it the previous session's
    // last blink duration still charged the new session's score,
    // possibly a different person's blink entirely.
    blinkState = initialBlinkState;
    blinkLogList.replaceChildren();
    captureState = null;
    calibrationRequested = false;
    calibrationOverlay.hidden = true;
    heatmapOpen = false;
    heatmapOverlay.hidden = true;
    heatmapGrid = emptyGrid();
    scanpathSamples = [];
    scanpathSlider.hidden = true;
    refreshReplayButton();
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
const gazeStateLabel = document.createElement("p");
gazeStateLabel.hidden = true;
const fixationStatsLabel = document.createElement("p");
fixationStatsLabel.hidden = true;

// The calibration capture screen: a dark overlay, one moving dot,
// click anywhere to cancel. A profile solved in an earlier visit
// survives in local storage and works from the first frame.
let calibrationProfile: CalibrationProfile | null = loadCalibrationProfile();
const calibrateButton = document.createElement("button");
calibrateButton.textContent =
  calibrationProfile === null ? "Calibrate gaze" : "Recalibrate gaze";
calibrateButton.hidden = true;
let calibrationRequested = false;
let captureState: CalibrationCapture | null = null;
calibrateButton.addEventListener("click", () => {
  calibrationRequested = true;
});

const calibrationOverlay = document.createElement("div");
// Stable handles for the end to end test. Styles and text can change
// freely, these names are the contract the test holds on to.
calibrationOverlay.dataset.testid = "calibration-overlay";
calibrationOverlay.hidden = true;
Object.assign(calibrationOverlay.style, {
  position: "fixed",
  inset: "0",
  background: "rgba(0, 0, 0, 0.85)",
  zIndex: "10",
  cursor: "pointer",
});
const calibrationDot = document.createElement("div");
calibrationDot.dataset.testid = "calibration-dot";
Object.assign(calibrationDot.style, {
  position: "absolute",
  width: "18px",
  height: "18px",
  borderRadius: "50%",
  background: "#ff9100",
  transform: "translate(-50%, -50%)",
  transition: "left 0.4s, top 0.4s",
});
const calibrationProgress = document.createElement("p");
Object.assign(calibrationProgress.style, {
  position: "absolute",
  bottom: "24px",
  width: "100%",
  textAlign: "center",
  color: "#ffffff",
});
calibrationOverlay.append(calibrationDot, calibrationProgress);
calibrationOverlay.addEventListener("click", () => {
  captureState = null;
  calibrationRequested = false;
  calibrationOverlay.hidden = true;
});

// The 5.9 gaze heatmap: a full viewport overlay showing a drawn test
// card, dwell accumulating as translucent heat. It is the calibrated
// profile's first live consumer, raw offsets have no screen meaning,
// so the button stays disabled until a profile exists.
const heatmapButton = document.createElement("button");
heatmapButton.hidden = true;
function refreshHeatmapButton(): void {
  heatmapButton.disabled = calibrationProfile === null;
  heatmapButton.textContent =
    calibrationProfile === null
      ? "Gaze heatmap (calibrate first)"
      : "Gaze heatmap";
}
refreshHeatmapButton();
const heatmapOverlay = document.createElement("div");
heatmapOverlay.hidden = true;
Object.assign(heatmapOverlay.style, {
  position: "fixed",
  inset: "0",
  background: "#101418",
  zIndex: "10",
  cursor: "pointer",
});
const heatmapCanvas = document.createElement("canvas");
heatmapCanvas.setAttribute(
  "aria-label",
  "Gaze heatmap accumulating over a test image",
);
heatmapOverlay.append(heatmapCanvas);
let heatmapGrid = emptyGrid();
let heatmapOpen = false;

// The 5.10 scanpath: while a heat session runs, every accumulated
// point is also remembered with its timestamp, and the replay button
// scrubs back through them. The cap holds five minutes at 60 fps,
// far beyond any card session; past it the oldest points fall away.
type ScanpathSample = { timestampMs: number; x: number; y: number };
let scanpathSamples: ScanpathSample[] = [];
const SCANPATH_SAMPLE_CAP = 18000;
// Fixation detection on screen points needs a screen sized box: five
// percent of the viewport, summed over both axes, quadrant-coarse in
// spirit like the heatmap grid.
const SCANPATH_SCREEN_DISPERSION = 0.05;
const replayButton = document.createElement("button");
replayButton.hidden = true;
function refreshReplayButton(): void {
  replayButton.disabled = scanpathSamples.length < 2;
  replayButton.textContent =
    scanpathSamples.length < 2
      ? "Replay scanpath (run the heatmap first)"
      : "Replay scanpath";
}
refreshReplayButton();
const scanpathSlider = document.createElement("input");
scanpathSlider.type = "range";
scanpathSlider.min = "0";
scanpathSlider.max = "1000";
scanpathSlider.value = "1000";
scanpathSlider.setAttribute("aria-label", "Replay time");
scanpathSlider.hidden = true;
Object.assign(scanpathSlider.style, {
  position: "absolute",
  bottom: "56px",
  left: "10%",
  width: "80%",
  cursor: "default",
});
// The slider lives inside a close-on-click overlay: its own clicks
// must not bubble up and slam the door mid scrub.
scanpathSlider.addEventListener("click", (event) => {
  event.stopPropagation();
});
scanpathSlider.addEventListener("input", () => {
  renderReplay();
});
heatmapOverlay.append(scanpathSlider);
heatmapButton.addEventListener("click", () => {
  heatmapGrid = emptyGrid();
  scanpathSamples = [];
  refreshReplayButton();
  heatmapCanvas.width = window.innerWidth;
  heatmapCanvas.height = window.innerHeight;
  scanpathSlider.hidden = true;
  heatmapOpen = true;
  heatmapOverlay.hidden = false;
});
replayButton.addEventListener("click", () => {
  heatmapCanvas.width = window.innerWidth;
  heatmapCanvas.height = window.innerHeight;
  scanpathSlider.value = "1000";
  scanpathSlider.hidden = false;
  heatmapOverlay.hidden = false;
  renderReplay();
});
heatmapOverlay.addEventListener("click", () => {
  heatmapOpen = false;
  heatmapOverlay.hidden = true;
  scanpathSlider.hidden = true;
  refreshReplayButton();
});

// The test card: five distinct shapes at known screen fractions, so
// the owner knows exactly where they looked. Drawn, not loaded, no
// image licence to carry.
function drawHeatmapCard(context: CanvasRenderingContext2D): void {
  const { width, height } = context.canvas;
  context.fillStyle = "#101418";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#78909c";
  context.fillStyle = "#78909c";
  context.lineWidth = 3;
  const size = Math.min(width, height) * 0.05;
  const atPx = (fx: number, fy: number): { x: number; y: number } => ({
    x: fx * width,
    y: fy * height,
  });
  // Top left: circle.
  const circle = atPx(0.15, 0.2);
  context.beginPath();
  context.arc(circle.x, circle.y, size, 0, 2 * Math.PI);
  context.stroke();
  // Top right: square.
  const square = atPx(0.85, 0.2);
  context.strokeRect(square.x - size, square.y - size, 2 * size, 2 * size);
  // Centre: cross.
  const cross = atPx(0.5, 0.5);
  context.beginPath();
  context.moveTo(cross.x - size, cross.y);
  context.lineTo(cross.x + size, cross.y);
  context.moveTo(cross.x, cross.y - size);
  context.lineTo(cross.x, cross.y + size);
  context.stroke();
  // Bottom left: triangle.
  const triangle = atPx(0.15, 0.8);
  context.beginPath();
  context.moveTo(triangle.x, triangle.y - size);
  context.lineTo(triangle.x + size, triangle.y + size);
  context.lineTo(triangle.x - size, triangle.y + size);
  context.closePath();
  context.stroke();
  // Bottom right: filled dot.
  const dot = atPx(0.85, 0.8);
  context.beginPath();
  context.arc(dot.x, dot.y, size / 2, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = "#eceff1";
  context.font = "16px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(
    "Look at the shapes, hold on each. Click anywhere to close.",
    width / 2,
    height - 24,
  );
}

function renderHeatmap(context: CanvasRenderingContext2D): void {
  drawHeatmapCard(context);
  const cells = normalizedCells(heatmapGrid);
  if (cells === null) {
    return;
  }
  const { width, height } = context.canvas;
  const cellWidth = width / heatmapGrid.cols;
  const cellHeight = height / heatmapGrid.rows;
  for (let row = 0; row < heatmapGrid.rows; row++) {
    for (let col = 0; col < heatmapGrid.cols; col++) {
      const heat = cells[row * heatmapGrid.cols + col] ?? 0;
      if (heat <= 0) {
        continue;
      }
      context.fillStyle = `rgba(255, 145, 0, ${String(0.55 * heat)})`;
      context.fillRect(
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
      );
    }
  }
}

// Draws the recorded path up to the slider's moment: the travelled
// line, circles around fixations sized by how long they held, and a
// dot at the current position. Pure lookups decide what is visible,
// this function only draws what they return.
function renderReplay(): void {
  const context = heatmapCanvas.getContext("2d");
  const first = scanpathSamples[0];
  const last = scanpathSamples[scanpathSamples.length - 1];
  if (context === null || first === undefined || last === undefined) {
    return;
  }
  drawHeatmapCard(context);
  const fraction = Number(scanpathSlider.value) / 1000;
  const atMs = sliderTime(first.timestampMs, last.timestampMs, fraction);
  const visible = replayIndex(
    scanpathSamples.map((sample) => sample.timestampMs),
    atMs,
  );
  const past = scanpathSamples.slice(0, visible);
  const { width, height } = heatmapCanvas;
  drawPolyline(
    context,
    past.map((sample) => ({ x: sample.x * width, y: sample.y * height })),
    1,
    "#546e7a",
  );
  // Fixations on screen points reuse the 5.7 detector with a screen
  // sized dispersion box passed explicitly. Structurally the same
  // pair of numbers, only the ruler changes.
  const fixations = detectFixations(
    past.map((sample) => ({
      timestampMs: sample.timestampMs,
      offset: { horizontal: sample.x, vertical: sample.y },
    })),
    SCANPATH_SCREEN_DISPERSION,
    MIN_FIXATION_DURATION_MS,
  );
  context.strokeStyle = "#ff9100";
  context.lineWidth = 2;
  for (const fixation of fixations) {
    const radius = 6 + Math.sqrt(fixation.endMs - fixation.startMs) / 2;
    context.beginPath();
    context.arc(
      fixation.centroid.horizontal * width,
      fixation.centroid.vertical * height,
      radius,
      0,
      2 * Math.PI,
    );
    context.stroke();
  }
  const current = past[past.length - 1];
  if (current !== undefined) {
    context.fillStyle = "#ff9100";
    context.beginPath();
    context.arc(current.x * width, current.y * height, 5, 0, 2 * Math.PI);
    context.fill();
  }
  context.fillStyle = "#eceff1";
  context.textAlign = "center";
  context.fillText(
    `Replay at ${((atMs - first.timestampMs) / 1000).toFixed(1)} s of ${((last.timestampMs - first.timestampMs) / 1000).toFixed(1)} s`,
    width / 2,
    24,
  );
}

// Four ways to answer where the eyes point. Off screen keeps its
// uncalibrated tag even with a profile: that boundary is still the
// guessed 5.3 threshold, only the quadrants are calibrated here.
function lookingTowardMessage(offset: IrisOffset | null): string {
  if (offset === null) {
    return "Looking toward: no valid measurement";
  }
  if (!isOnScreen(offset)) {
    return "Looking toward: off screen (uncalibrated)";
  }
  if (calibrationProfile === null) {
    return `Looking toward: ${screenQuadrant(offset)} (uncalibrated)`;
  }
  const point = calibratedPoint(calibrationProfile, offset);
  return `Looking toward: ${calibratedQuadrant(point)} (calibrated)`;
}

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
const perclosLabel = document.createElement("p");
perclosLabel.hidden = true;
let perclosState = emptyPerclos();
const longClosureLabel = document.createElement("p");
longClosureLabel.hidden = true;
let longClosureState = initialLongClosureState;
// The shut-line BASELINE freezes at the FIRST ready baseline, and
// both shut-line consumers, the long closure detector and PERCLOS,
// derive their line from this one frozen number. The 4.2 ratchet
// keeps serving the blink line, where a rising baseline means better
// sensitivity, but the shut line's anchors are absolute lid geometry:
// adversarial review showed two seconds of widened eyes would ratchet
// a live shut line above the measured reading droop, bringing false
// alarms back for long closures and, at the 0.4 line, saturating
// PERCLOS to a false 100 percent during ordinary reading. Frozen and
// shared, neither can happen and the two detectors cannot drift
// apart. Camera restart re-learns.
let frozenShutBaselineMm: number | null = null;

// The alert banner: hidden until a firing, then visible for the
// display window. The frame loop owns its visibility while the
// camera runs; render() only forces it hidden when the camera stops.
const alertBanner = document.createElement("p");
alertBanner.setAttribute("role", "alert");
alertBanner.hidden = true;
Object.assign(alertBanner.style, {
  background: "#ff9100",
  color: "#1a1a1a",
  fontWeight: "bold",
  padding: "8px 12px",
});
let alertState = initialAlertState;

// The 6.4 feature vector: one typed row per second, the raw material
// for the 6.5 score and the 6.7 export. A bounded hour of rows.
const featureLabel = document.createElement("p");
featureLabel.hidden = true;
// The 6.7 export: one session becomes one file, on this device only.
// The 6.8 self report: the project's first LABEL, asked at the start
// of a session and again at export. Skipping is a real answer and is
// recorded as one; a refusal must never be rounded to a middle
// value, which would put a fabricated label in a training set.
let kssBefore: KssRating | null = null;
let kssAfter: KssRating | null = null;
const kssPanel = document.createElement("div");
kssPanel.hidden = true;
const kssPrompt = document.createElement("p");
const kssButtons = document.createElement("div");
kssPanel.append(kssPrompt, kssButtons);

function askKss(
  question: string,
  onAnswer: (r: KssRating | null) => void,
): void {
  kssPrompt.textContent = question;
  const choose = (rating: KssRating | null): void => {
    kssPanel.hidden = true;
    onAnswer(rating);
  };
  kssButtons.replaceChildren(
    ...KSS_SCALE.map((step) => {
      const button = document.createElement("button");
      button.textContent = `${String(step.rating)} ${step.label}`;
      button.style.display = "block";
      button.addEventListener("click", () => {
        choose(step.rating);
      });
      return button;
    }),
  );
  const skip = document.createElement("button");
  skip.textContent = "Skip";
  skip.style.display = "block";
  skip.addEventListener("click", () => {
    choose(null);
  });
  kssButtons.append(skip);
  kssPanel.hidden = false;
}

function exportSession(): void {
  const csv = serializeRecords(
    featureRecords,
    kssMetadataRows(kssBefore, kssAfter),
  );
  if (csv === null) {
    return;
  }
  // Colons are not safe in filenames on every system, so the ISO
  // stamp is punctuated with dashes: sorts by name, sorts by time.
  const stamp = new Date(sessionStartedAtEpochMs ?? Date.now())
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  downloadTextFile(`blinklab-session-${stamp}.csv`, csv, "text/csv");
}

const exportButton = document.createElement("button");
exportButton.textContent = "Export CSV";
exportButton.hidden = true;
exportButton.disabled = true;
exportButton.addEventListener("click", () => {
  // The after answer is asked once, on the first export, so the
  // question arrives when the session is actually over rather than
  // interrupting it.
  if (kssAfter === null) {
    askKss("How sleepy do you feel now?", (rating) => {
      kssAfter = rating;
      exportSession();
    });
    return;
  }
  exportSession();
});
// The 6.5 demo score, one glanceable number with its audit trail
// close behind (6.6). The disclaimer is part of the line, always.
const scoreLabel = document.createElement("p");
scoreLabel.hidden = true;
scoreLabel.style.fontWeight = "bold";
// The 6.6 contribution panel: the score's own arithmetic, shown.
const panelSummaryLabel = document.createElement("p");
panelSummaryLabel.hidden = true;
const panelList = document.createElement("ul");
panelList.setAttribute("aria-label", "Score contributions");
panelList.hidden = true;
let featureRecords: FeatureRecord[] = [];
let lastRecordAtMs: number | null = null;
// The frame clock is milliseconds since page load, which is right
// for durations and useless for dating a session, so the wall clock
// is captured once when recording begins. Taken from the buffer's
// first row instead, the name would change on every export once the
// 3600 row cap starts discarding, naming a session by a moment that
// is no longer in it.
let sessionStartedAtEpochMs: number | null = null;

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
let earSamples: TimedSample[] = [];

// The 5.6 gaze traces: raw and smoothed mean offset per axis, over
// the same 10 second window. Display flips the sign so both charts
// read in the user's language: glance toward YOUR right and the
// horizontal trace rises, look up and the vertical trace rises, a
// blink notches the vertical trace briefly downward.
const GAZE_TRACE_HALF = 0.3;
function createGazeTraceCanvas(label: string): HTMLCanvasElement {
  const traceCanvas = document.createElement("canvas");
  traceCanvas.width = 640;
  traceCanvas.height = 60;
  traceCanvas.hidden = true;
  traceCanvas.setAttribute("aria-label", label);
  return traceCanvas;
}
const gazeTraceHorizontalCanvas = createGazeTraceCanvas(
  "Horizontal gaze offset over the last 10 seconds, raw and smoothed",
);
const gazeTraceHorizontalContext = gazeTraceHorizontalCanvas.getContext("2d");
const gazeTraceVerticalCanvas = createGazeTraceCanvas(
  "Vertical gaze offset over the last 10 seconds, raw and smoothed",
);
const gazeTraceVerticalContext = gazeTraceVerticalCanvas.getContext("2d");
let gazeSmoothing: GazeSmoothingState | null = null;
type GazeTraces = {
  rawH: TimedSample[];
  smoothedH: TimedSample[];
  rawV: TimedSample[];
  smoothedV: TimedSample[];
};
const emptyGazeTraces = (): GazeTraces => ({
  rawH: [],
  smoothedH: [],
  rawV: [],
  smoothedV: [],
});
let gazeTraces = emptyGazeTraces();

// The 5.7 fixation buffer: smoothed samples since the last gap,
// capped to the same 10 second window as the traces.
let gazeSamples: GazeSample[] = [];

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
      let frameFixationStats: FixationStats | null = null;
      let frameFixating: boolean | null = null;
      let frameOnScreen: boolean | null = null;
      let stabilityPx: number | null = null;
      let stabilityMm: number | null = null;
      let frameMeanOffset: IrisOffset | null = null;
      const face = result.faceLandmarks[0];
      // A wrong landmark count refuses the face the same way a lost
      // face does: the frame flows on and the second's record shows
      // honest nulls. Review found the old early return here made
      // wrong-count seconds vanish from the record stream entirely,
      // two different meanings of "untrusted" in one pipeline.
      let faceTrusted = false;
      if (face !== undefined) {
        const validation = validateLandmarkCount(face.length);
        modelStatus.textContent = landmarkValidationMessage(validation);
        faceTrusted = validation.kind === "valid";
      }
      if (face !== undefined && faceTrusted) {
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
          frameMeanOffset = meanOffset;
          frameOnScreen = meanOffset === null ? null : isOnScreen(meanOffset);
          quadrantLabel.textContent = lookingTowardMessage(meanOffset);
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

      // The smoothing filter runs every frame on the mean offset. An
      // untrusted frame (gate refused, face lost) resets it: the
      // traces draw the gap, the filter restarts fresh after it. The
      // quadrant line and calibration capture stay on the RAW signal,
      // wiring smoothed gaze into consumers is 5.7's business.
      const smoothedGaze = gazeSmoothingStep(
        gazeSmoothing,
        nowMs,
        frameMeanOffset,
      );
      gazeSmoothing = smoothedGaze.state;
      const pushTrace = (
        samples: TimedSample[],
        offset: IrisOffset | null,
        axis: "horizontal" | "vertical",
      ): TimedSample[] =>
        pushBounded(
          samples,
          {
            timestampMs: nowMs,
            value: offset === null ? null : GAZE_TRACE_HALF - offset[axis],
          },
          1200,
        );
      gazeTraces = {
        rawH: pushTrace(gazeTraces.rawH, frameMeanOffset, "horizontal"),
        smoothedH: pushTrace(
          gazeTraces.smoothedH,
          smoothedGaze.smoothed,
          "horizontal",
        ),
        rawV: pushTrace(gazeTraces.rawV, frameMeanOffset, "vertical"),
        smoothedV: pushTrace(
          gazeTraces.smoothedV,
          smoothedGaze.smoothed,
          "vertical",
        ),
      };

      // Fixation and saccade separation runs on the smoothed signal,
      // its first consumer. A gap clears the buffer: a fixation that
      // bridged a lost face would be an invented stillness.
      if (smoothedGaze.smoothed === null) {
        gazeSamples = [];
        gazeStateLabel.textContent = "Gaze state: no valid measurement";
        fixationStatsLabel.textContent = "Fixations in the last 10 s: none yet";
      } else {
        gazeSamples = pushBounded(
          gazeSamples,
          { timestampMs: nowMs, offset: smoothedGaze.smoothed },
          1200,
        ).filter((sample) => nowMs - sample.timestampMs <= SPARK_WINDOW_MS);
        const fixations = detectFixations(gazeSamples);
        const lastFixation = fixations[fixations.length - 1];
        // Fixating right now means the newest fixation reaches the
        // newest sample. "Moving" covers a saccade in flight and the
        // first not-yet-long-enough moments of the next stillness.
        gazeStateLabel.textContent =
          lastFixation !== undefined && lastFixation.endMs === nowMs
            ? `Gaze state: fixating for ${((lastFixation.endMs - lastFixation.startMs) / 1000).toFixed(1)} s`
            : "Gaze state: moving";

        // The statistics include the still-growing fixation at its
        // length so far: a panel that waits for the end lags the eye.
        const stats = fixationStats(fixations);
        frameFixationStats = stats;
        frameFixating =
          lastFixation !== undefined && lastFixation.endMs === nowMs;
        fixationStatsLabel.textContent =
          stats === null
            ? "Fixations in the last 10 s: none yet"
            : `Fixations in the last 10 s: ${String(stats.count)}, duration mean ${stats.meanMs.toFixed(0)} ms, median ${stats.medianMs.toFixed(0)} ms, longest ${stats.longestMs.toFixed(0)} ms`;
      }

      // While the heatmap overlay is up, every trusted frame adds one
      // frame of dwell to the calibrated gaze point's cell. Untrusted
      // frames add nothing, and the core grid ignores points that
      // land outside the unit square.
      if (heatmapOpen) {
        if (smoothedGaze.smoothed !== null && calibrationProfile !== null) {
          const point = calibratedPoint(
            calibrationProfile,
            smoothedGaze.smoothed,
          );
          heatmapGrid = accumulate(heatmapGrid, point);
          scanpathSamples = pushBounded(
            scanpathSamples,
            { timestampMs: nowMs, x: point.x, y: point.y },
            SCANPATH_SAMPLE_CAP,
          );
        }
        const heatmapContext = heatmapCanvas.getContext("2d");
        if (heatmapContext !== null) {
          renderHeatmap(heatmapContext);
        }
      }

      if (calibrationRequested) {
        captureState = startCapture(nowMs);
        calibrationRequested = false;
        calibrationOverlay.hidden = false;
      }
      if (captureState !== null) {
        captureState = captureStep(captureState, nowMs, frameMeanOffset);
        if (isCaptureDone(captureState)) {
          saveCalibrationSamples(captureState.completed);
          // Solve immediately: the very next frame classifies with
          // the fresh profile. A refused solve keeps the old profile,
          // stale beats poisoned.
          const solved = solveCalibration(captureState.completed);
          if (solved !== null) {
            calibrationProfile = solved;
            saveCalibrationProfile(solved);
          }
          captureState = null;
          calibrationOverlay.hidden = true;
          calibrateButton.textContent =
            solved === null
              ? "Recalibrate gaze (solver refused the samples, try again)"
              : "Recalibrate gaze";
          refreshHeatmapButton();
        } else {
          const target = CALIBRATION_TARGETS[captureState.targetIndex];
          if (target !== undefined) {
            calibrationDot.style.left = `${String(target.x * 100)}%`;
            calibrationDot.style.top = `${String(target.y * 100)}%`;
          }
          calibrationProgress.textContent = `Follow the dot (${String(captureState.targetIndex + 1)}/9). Click anywhere to cancel.`;
        }
      }

      earSamples = pushBounded(
        earSamples,
        { timestampMs: nowMs, value: meanEar },
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

      // Roadmap amendment 5: the long closure detector no longer
      // rides the blink line. Eyes SHUT is the deeper 40 percent
      // line, measured between the owner's shut floor and their
      // relaxed reading droop; a lid relaxed between the two lines
      // is a partial droop, deliberately neither blink nor long
      // closure. No baseline yet means no personal shut line yet,
      // so the frame is untrusted for this detector, the same rule
      // PERCLOS keeps. The zero threshold below is never read: a
      // null aperture returns before any comparison.
      if (frozenShutBaselineMm === null && baselineState.kind === "ready") {
        frozenShutBaselineMm = baselineState.baselineMm;
      }
      const longCountBefore = longClosureState.count;
      // The zero below is never read: a null aperture returns before
      // any comparison, and the aperture is null whenever the shut
      // line is not yet frozen.
      longClosureState = longClosureStep(
        longClosureState,
        nowMs,
        frozenShutBaselineMm !== null && blinkMeasurable ? stabilityMm : null,
        frozenShutBaselineMm !== null
          ? longClosureThresholdMm(frozenShutBaselineMm)
          : 0,
      );

      // Each new long closure event asks the alert governor whether
      // a person gets told; the governor's debounce decides. The text
      // is written ONLY on the firing edge: the banner is an
      // assertive live region, and rewriting it per frame would make
      // screen readers announce every suppressed trigger, defeating
      // the debounce for exactly those users.
      const alertResult = alertStep(
        alertState,
        nowMs,
        longClosureState.count > longCountBefore,
      );
      alertState = alertResult.state;
      if (alertResult.fires) {
        alertBanner.textContent = `Alert: long eye closure (alerts: ${String(alertState.firedCount)}, suppressed: ${String(alertState.suppressedCount)})`;
      }
      alertBanner.hidden = !alertVisible(alertState, nowMs);
      if (frozenShutBaselineMm === null) {
        // An asserted zero built on frames the detector never saw
        // would break the null-never-zero rule: say why instead.
        longClosureLabel.textContent =
          "Long closures: waiting for the baseline";
      } else {
        const ongoingMs = ongoingClosureMs(longClosureState, nowMs);
        const longClosureParts = [
          `Long closures: ${String(longClosureState.count)}`,
        ];
        if (ongoingMs !== null) {
          longClosureParts.push(
            `eyes closed ${(ongoingMs / 1000).toFixed(1)} s and counting`,
          );
        } else if (longClosureState.lastLongClosureDurationMs !== null) {
          longClosureParts.push(
            `last: ${longClosureState.lastLongClosureDurationMs.toFixed(0)} ms`,
          );
        }
        longClosureLabel.textContent =
          longClosureParts.length > 1
            ? `${longClosureParts[0] ?? ""} (${longClosureParts.slice(1).join(", ")})`
            : (longClosureParts[0] ?? "");
      }

      // PERCLOS rides the same trusted aperture feed as the blink
      // reducer: below the fps gate the frame is untrusted, before
      // the baseline is ready there is no personal closed line yet,
      // both cases join neither side of the ratio.
      perclosState = perclosStep(
        perclosState,
        nowMs,
        blinkMeasurable ? stabilityMm : null,
        frozenShutBaselineMm,
      );
      const perclos = perclosValue(perclosState, nowMs);
      perclosLabel.textContent =
        perclos === null
          ? "PERCLOS (eyes closed share, last 60 s): measuring..."
          : `PERCLOS (eyes closed share, last 60 s): ${(perclos * 100).toFixed(1)}%`;

      // One typed row per second. The assembler's identity shape is
      // the honesty here: every field must be supplied, so a metric
      // cannot silently fall out of the record.
      if (lastRecordAtMs === null || nowMs - lastRecordAtMs >= 1000) {
        lastRecordAtMs = nowMs;
        const lastShape = blinkEvents[blinkEvents.length - 1]?.shape ?? null;
        featureRecords = pushBounded(
          featureRecords,
          assembleFeatureRecord({
            timestampMs: nowMs,
            faceDetected: face !== undefined && faceTrusted,
            fps,
            apertureMm: stabilityMm,
            baselineMm:
              baselineState.kind === "ready" ? baselineState.baselineMm : null,
            shutBaselineMm: frozenShutBaselineMm,
            blinkRatePerMin: gatedBlinkRatePerMin(fps, rateState, nowMs),
            lastBlinkDurationMs: blinkState.lastBlinkDurationMs,
            lastBlinkAmplitudeMm: lastShape?.amplitudeMm ?? null,
            lastBlinkPeakVelocityMmPerS:
              lastShape?.peakClosingVelocityMmPerS ?? null,
            perclos,
            longClosureCount: longClosureState.count,
            fixationCount: frameFixationStats?.count ?? null,
            fixationMedianMs: frameFixationStats?.medianMs ?? null,
            fixating: frameFixating,
            onScreen: frameOnScreen,
          }),
          3600,
        );
        // Cadence is ABOUT one row per second (the gate re-arms on
        // the firing frame), and the cap drops the oldest row
        // silently, so both truths reach the label. Durations come
        // from timestamps, never from row counts.
        sessionStartedAtEpochMs ??= Date.now();
        exportButton.disabled = featureRecords.length === 0;
        featureLabel.textContent =
          featureRecords.length >= 3600
            ? "Feature records: last 3600 kept, oldest discarded (about one per second)"
            : `Feature records: ${String(featureRecords.length)} this session (about one per second)`;

        // The score reads the last minute of rows, selected by
        // TIMESTAMP inside core: a row-count window would bridge a
        // paused tab's gap and charge closures from ten minutes ago.
        const breakdown = scoreRecords(featureRecords);
        const noFaceNow =
          featureRecords[featureRecords.length - 1]?.faceDetected;
        scoreLabel.textContent =
          breakdown !== null
            ? `Alertness score: ${String(breakdown.score)} / 100 (demo, not a safety or medical device)`
            : noFaceNow === false
              ? "Alertness score: no face in frame (demo, not a safety or medical device)"
              : "Alertness score: measuring... (demo, not a safety or medical device)";

        // The panel speaks only when a score exists: with no score
        // there is no arithmetic to explain, and an empty list under
        // a refusal would read as a broken panel.
        if (breakdown === null) {
          panelSummaryLabel.textContent = "";
          panelList.replaceChildren();
        } else {
          panelSummaryLabel.textContent = panelSummary(breakdown);
          panelList.replaceChildren(
            ...topDrivers(breakdown).map((driver) => {
              const item = document.createElement("li");
              item.textContent = formatDriver(driver);
              return item;
            }),
          );
        }
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
      const drawGazeTraces = (
        traceContext: CanvasRenderingContext2D | null,
        raw: readonly TimedSample[],
        smoothed: readonly TimedSample[],
      ): void => {
        if (traceContext === null) {
          return;
        }
        const { width, height } = traceContext.canvas;
        traceContext.clearRect(0, 0, width, height);
        // The centre line is zero offset, eyes straight at the camera.
        drawPolyline(
          traceContext,
          [
            { x: 0, y: height / 2 },
            { x: width, y: height / 2 },
          ],
          1,
          "#37474f",
        );
        for (const segment of sparklineSegments(
          raw,
          nowMs,
          SPARK_WINDOW_MS,
          width,
          height,
          2 * GAZE_TRACE_HALF,
        )) {
          drawPolyline(traceContext, segment, 1, "#546e7a");
        }
        for (const segment of sparklineSegments(
          smoothed,
          nowMs,
          SPARK_WINDOW_MS,
          width,
          height,
          2 * GAZE_TRACE_HALF,
        )) {
          drawPolyline(traceContext, segment, 2, "#ff9100");
        }
      };
      drawGazeTraces(
        gazeTraceHorizontalContext,
        gazeTraces.rawH,
        gazeTraces.smoothedH,
      );
      drawGazeTraces(
        gazeTraceVerticalContext,
        gazeTraces.rawV,
        gazeTraces.smoothedV,
      );
    }
  }
});

app.append(
  demoNotice,
  title,
  startButton,
  picker,
  canvas,
  mirrorLabel,
  resolutionLabel,
  modelStatus,
  status,
  scoreLabel,
  panelSummaryLabel,
  panelList,
  fpsLabel,
  inferenceLabel,
  earLabel,
  apertureLabel,
  stabilityLabel,
  headPoseLabel,
  gazeLabel,
  quadrantLabel,
  gazeStateLabel,
  fixationStatsLabel,
  calibrateButton,
  heatmapButton,
  replayButton,
  gateLabel,
  blinkLabel,
  baselineLabel,
  blinkShapeLabel,
  perclosLabel,
  longClosureLabel,
  alertBanner,
  featureLabel,
  exportButton,
  kssPanel,
  sparkCanvas,
  gazeTraceHorizontalCanvas,
  gazeTraceVerticalCanvas,
  blinkLogList,
  ...(recorder !== null ? [recorder.button] : []),
  calibrationOverlay,
  heatmapOverlay,
);
render();
