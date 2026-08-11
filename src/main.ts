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
import {
  clipRefusedMessage,
  fpsGateMessage,
  measurableAtFps,
} from "./core/fpsGate";
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
  eventsForDisplay,
  formatBlinkEvent,
  serialiseBlinkEvents,
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
import {
  sparklineSegments,
  withinWindow,
  type TimedSample,
} from "./core/sparkline";
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
import type { VideoFrameLoop } from "./io/frameLoop";
import {
  startFrameLoop,
  startVideoFrameLoop,
  supportsVideoFrameCallback,
} from "./io/frameLoop";
import { loadVideoFile, unloadVideoFile } from "./io/videoFile";
import { stepThroughVideo } from "./io/videoStepper";
import type { FrameClockState, FrameSource } from "./core/frameClock";
import type { MeasurementMode } from "./core/frameClock";
import {
  acceptFrame,
  checkStepping,
  coverageMetadataRows,
  frameTimestampMs,
  sourceMetadataRows,
  startFrameClock,
  steppingProgress,
  steppingWarning,
} from "./core/frameClock";
import { loadLandmarker } from "./io/landmarker";
import {
  drawDots,
  drawFittedCircle,
  drawPolyline,
  drawVideoFrame,
} from "./io/videoCanvas";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error('index.html must contain an element with id "app"');
}

const title = document.createElement("h1");
title.textContent = "Alertness measurement demo";

// The permanent notice, 6.9. Present before the camera starts, never
// dismissible, and above everything so it cannot be scrolled past
// unseen. The score line keeps its own parenthetical: a number and
// its caveat should travel together.
const demoNotice = document.createElement("p");
demoNotice.dataset.testid = "demo-notice";
demoNotice.textContent = demoNoticeText();
Object.assign(demoNotice.style, {
  background: "#f5c518",
  // The text colour is set explicitly rather than inherited: on a
  // fixed background an inherited colour would follow the page or the
  // reader's dark mode and could end up unreadable. Near-black on
  // yellow rather than the white the mockup showed, because white on
  // yellow is poor contrast and this is the one line on the page that
  // must be readable by everyone.
  color: "#1a1a1a",
  padding: "8px 16px",
  margin: "0",
  textAlign: "center",
  fontWeight: "normal",
  fontSize: "12px",
  lineHeight: "1.4",
});

// The top bar. Holds the name and one outbound link, nothing else. It
// deliberately does not stick: this page gets screenshotted and filmed,
// and fixed chrome eats vertical space on a laptop for no measurement
// benefit.
const navBar = document.createElement("div");
navBar.className = "page-column";
Object.assign(navBar.style, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  borderBottom: "1px solid #e4e4e4",
});

const linkedInLink = document.createElement("a");
linkedInLink.href = "https://www.linkedin.com/in/eivinasnorusaitis";
const linkedInMark = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "svg",
);
linkedInMark.setAttribute("viewBox", "0 0 24 24");
linkedInMark.setAttribute("width", "16");
linkedInMark.setAttribute("height", "16");
linkedInMark.setAttribute("fill", "currentColor");
linkedInMark.setAttribute("aria-hidden", "true");
const linkedInPath = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "path",
);
linkedInPath.setAttribute(
  "d",
  "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z",
);
linkedInMark.append(linkedInPath);
linkedInLink.append(
  linkedInMark,
  document.createTextNode("/eivinasnorusaitis"),
);
linkedInLink.target = "_blank";
// noopener stops the opened page from reaching back into this one
// through window.opener, which matters more than usual here because
// this page's whole claim is that nothing leaves the device.
linkedInLink.rel = "noopener noreferrer";
Object.assign(linkedInLink.style, {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#0a66c2",
  textDecoration: "none",
});

// One strip for everything the app needs to say out loud: camera and
// clip failures, clip progress, the model breaking its contract, and
// the long closure alert. It collapses to nothing when silent, because
// a permanently blank bar reads as broken on an idle page.
const statusBanner = document.createElement("div");
statusBanner.dataset.testid = "status-banner";
statusBanner.id = "status-banner";

// Says so when there is nothing to say. The banner used to collapse,
// which meant the whole page stepped down the moment anything appeared
// and stepped back up when it left. A strip that is always there costs
// one line and buys a page that never moves.
const bannerIdle = document.createElement("p");
bannerIdle.className = "banner-idle";
bannerIdle.textContent = "No alerts at this time.";
// The banner is a box, not a column, so it sits INSIDE a column rather
// than being one. That is why its edges line up with the boxes below
// it: the same `.page-column` rule sets both insets. It used to line up
// because a hand-written `calc(100% - 32px)` subtracted the same number
// the column happened to pad by, which is two places to change and one
// of them silently wrong.
const bannerColumn = document.createElement("div");
bannerColumn.className = "page-column";
bannerColumn.append(statusBanner);

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

// Where frames come from, and therefore which clock times them.
let frameSource: FrameSource = "camera";
let frameClock: FrameClockState = startFrameClock();
let loadedClipName: string | null = null;
let measurementMode: MeasurementMode = "live";
let framesMeasured = 0;
// How many frames the blink gate ACCEPTED. Zero after a whole clip means
// the frame rate never once cleared the floor, which is a refusal and not
// a failure, and the two must not read the same. Issue #192.
let framesBlinkMeasurable = 0;
let loadedClipDurationSeconds: number | null = null;
let currentFrameIndex: number | null = null;
// The frame on which the eyelid first crossed the blink line. Held
// here rather than in the reducer, which is pure and knows nothing
// about frames.
let closureStartFrame: number | null = null;

// Uploading a clip runs it through the same pipeline as the camera,
// which is what makes an offline dataset measurable by this instrument
// at all. Accept only video, so the picker does not offer a photo.
const clipInput = document.createElement("input");
clipInput.type = "file";
clipInput.accept = "video/*";
clipInput.setAttribute("data-testid", "clip-input");
const clipLabel = document.createElement("label");
// Its own line. Inline, it collided with the Start camera button and
// the first letter sat underneath it.
Object.assign(clipLabel.style, { display: "block", margin: "8px 0" });
clipLabel.append("Or measure a recorded clip: ", clipInput);

// Stepping is the DEFAULT for a clip, and that is a deliberate choice
// about what kind of tool this is. Watching a clip measures it at
// whatever rate the model manages on this machine, so the same file
// gives different numbers on different hardware. Stepping waits for
// the instrument on every frame, so the result is a property of the
// file. Watching stays available because it is far nicer to look at,
// and a demo is a fair reason to want that.
const stepToggle = document.createElement("input");
stepToggle.type = "checkbox";
stepToggle.checked = true;
stepToggle.setAttribute("data-testid", "step-toggle");
const stepLabel = document.createElement("label");
Object.assign(stepLabel.style, { display: "block", margin: "0 0 8px 0" });
stepLabel.append(
  stepToggle,
  " Measure every frame (slower to watch, but the same on every machine)",
);
clipInput.addEventListener("change", () => {
  const file = clipInput.files?.[0];
  // Cleared so that picking the SAME file again fires another change
  // event. Without this a clip that failed, or one that finished and
  // needs a second run, cannot be retried without reloading the page.
  clipInput.value = "";
  if (file !== undefined) {
    void beginVideoFile(file);
  }
});

// Stepping a three minute clip takes minutes. Without a way out, the
// only escape from a run started by accident is reloading the page,
// which throws away everything measured so far.
const stopClipButton = document.createElement("button");
stopClipButton.textContent = "Stop measuring";
stopClipButton.hidden = true;
stopClipButton.setAttribute("data-testid", "stop-clip");
stopClipButton.addEventListener("click", () => {
  clipStopRequested = true;
  status.textContent = "Stopping after this frame...";
});

// The per-decoded-frame loop belongs to whichever clip is loaded, so
// it is stopped whenever the source changes or the clip ends.
let clipLoop: VideoFrameLoop | null = null;
// A stepped run is a loop inside an await, so it cannot be cancelled
// by clearing a handle. It checks this between frames instead.
let clipStopRequested = false;
// Which call to beginCamera or beginVideoFile owns the page. Both
// functions hold long awaits, and the user can start a new source in
// the middle of one: the clip input stays enabled during a run, and
// the success line even says "pick another clip". A superseded run's
// continuation must then touch nothing. Review of remediation B1
// found the stale summary could refuse the NEW run's session as
// "nothing measured", or hand checkStepping one run's sought count
// beside another run's measured count.
let sourceRunToken = 0;

// A finished clip must stop claiming to be running. Every readout
// would otherwise freeze on its last value while the page still says
// the session is live, and the export button would sit there beside a
// number that stopped being true.
video.addEventListener("ended", () => {
  if (frameSource !== "file") return;
  clipLoop?.stop();
  clipLoop = null;
  status.textContent =
    "The clip finished. Export the CSV, or pick another clip.";
});

// People expect to see themselves as a mirror shows them.
let mirrored = true;

const mirrorLabel = document.createElement("label");
const mirrorToggle = document.createElement("input");
mirrorToggle.type = "checkbox";
mirrorToggle.checked = mirrored;
mirrorToggle.addEventListener("change", () => {
  mirrored = mirrorToggle.checked;
});
mirrorLabel.style.whiteSpace = "nowrap";
mirrorLabel.append(mirrorToggle, " Mirror");
mirrorLabel.hidden = true;

// The tracking overlays, off by default.
//
// They exist to prove the model has found your eyes, which is a real
// job and the reason manual check 53 asks you to watch them. But they
// sit on top of a face, and a face with dots drawn on it is not what
// anyone wants to look at in a demo. Off by default, one click away
// when you need to check the model rather than watch the person.
let showEyeMarkers = false;
const eyeMarkerToggle = document.createElement("input");
eyeMarkerToggle.type = "checkbox";
eyeMarkerToggle.checked = showEyeMarkers;
eyeMarkerToggle.setAttribute("data-testid", "eye-markers");
eyeMarkerToggle.addEventListener("change", () => {
  showEyeMarkers = eyeMarkerToggle.checked;
});
const eyeMarkerLabel = document.createElement("label");
eyeMarkerLabel.style.whiteSpace = "nowrap";
eyeMarkerLabel.append(eyeMarkerToggle, " Eye markers");
eyeMarkerLabel.hidden = true;

let showFaceMesh = false;
const faceMeshToggle = document.createElement("input");
faceMeshToggle.type = "checkbox";
faceMeshToggle.checked = showFaceMesh;
faceMeshToggle.setAttribute("data-testid", "face-mesh");
faceMeshToggle.addEventListener("change", () => {
  showFaceMesh = faceMeshToggle.checked;
});
const faceMeshLabel = document.createElement("label");
faceMeshLabel.style.whiteSpace = "nowrap";
faceMeshLabel.append(faceMeshToggle, " Face mesh");
faceMeshLabel.hidden = true;

const resolutionLabel = document.createElement("p");
// Pushed to the right of the toggles rather than wrapping below them,
// which is where flex put it once three checkboxes shared the row.
resolutionLabel.style.marginLeft = "auto";
resolutionLabel.style.textAlign = "right";
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
  const running = state.kind === "running";
  status.textContent = cameraStateMessage(state);
  // The state's name, machine readable. The status text is prose for
  // a person, and the batch runner in tools/measure_corpus.mjs was
  // matching prose prefixes to learn the outcome, which left it
  // waiting forever on any failure it did not know the words for.
  status.dataset.state = state.kind;

  // Readouts stay on the page at idle, showing their own
  // "measuring..." and "no valid measurement" lines. The line count
  // therefore never changes as values arrive, so nothing reflows
  // during the first minute, which is exactly when someone is deciding
  // whether to trust what they are reading.

  // The picture. An empty canvas is a blank rectangle that reads as a
  // failure, so it is the one thing genuinely hidden.
  canvas.hidden = !running;
  mirrorLabel.hidden = !running;
  eyeMarkerLabel.hidden = !running;
  faceMeshLabel.hidden = !running;
  resolutionLabel.hidden = !running;

  // The traces, same reason: three empty strips look broken.
  sparkCanvas.hidden = !running;
  gazeTraceHorizontalCanvas.hidden = !running;
  gazeTraceVerticalCanvas.hidden = !running;

  // Left alone this reports the DISPLAY's refresh rate as though it
  // were the instrument's, which is a wrong number rather than a
  // missing one.
  if (!running) {
    writeReadout(fpsLabel, "");
    writeReadout(inferenceLabel, "");
  }

  // Buttons are DISABLED rather than hidden. A greyed "Calibrate gaze"
  // says the feature exists and is not available yet; a missing one
  // says nothing at all.
  // Calibrate is available whenever a source runs, so render owns it
  // outright. The other four have their own conditions, an export needs
  // records, the heatmap needs a profile, the replay needs a scanpath,
  // and the frame loop sets those while running. Here they are only
  // forced off, never on, or this would overrule them.
  calibrateButton.disabled = !running;
  if (!running) {
    for (const button of [
      heatmapButton,
      replayButton,
      exportButton,
      exportBlinksButton,
    ]) {
      button.disabled = true;
    }
  }
  if (recorder !== null) {
    recorder.button.disabled = !running;
  }

  // A question, not a readout.
  if (!running) {
    kssPanel.hidden = true;
    alertBanner.hidden = true;
  }

  startButton.hidden = running || state.kind === "requesting";
}

function setState(next: CameraState): void {
  state = next;
  // Sized after the page is in the document, because the box has no
  // width until it is laid out.
  sizeGraphsToBox();
  window.addEventListener("resize", sizeGraphsToBox);

  render();
}

// Everything a new session must forget. Shared by the camera and the
// file paths, because a reset that is right for one and half-applied
// to the other is exactly the bug that carried one session's last
// blink duration into the next session's score.
function resetSession(): void {
  // Light, distance and even the person may have changed.
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
  exportBlinksButton.disabled = true;
  sessionStartedAtEpochMs = null;
  kssBefore = null;
  kssAfter = null;
  writeReadout(featureLabel, "");
  writeReadout(scoreLabel, "");
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
  // A new source starts a new time axis. Carrying the old clock
  // forward would reject every frame of a clip that starts at zero.
  frameClock = startFrameClock();
  frameTimestampsMs = [];
  // Review found these two missed, and the new clock made the omission
  // dangerous: a clip's first blink shape was computed from the
  // PREVIOUS session's aperture trace and exported as this clip's.
  framesMeasured = 0;
  framesBlinkMeasurable = 0;
  currentFrameIndex = null;
  closureStartFrame = null;
  stabilitySamples = [];
  earSamples = [];
  writeReadout(blinkShapeLabel, "");
  refreshReplayButton();
}

function fitCanvasTo(widthPx: number, heightPx: number): void {
  const display = displaySize(widthPx, heightPx, 640);
  if (display !== null) {
    canvas.width = display.width;
    canvas.height = display.height;
  }
  canvasContext = canvas.getContext("2d");
}

async function beginCamera(deviceId?: string): Promise<void> {
  sourceRunToken += 1;
  const runToken = sourceRunToken;
  setState({ kind: "requesting" });
  clipStopRequested = true;
  clipLoop?.stop();
  clipLoop = null;
  // A camera session has no clip to stop. Without this, a stepped run
  // superseded by the camera left its button behind.
  stopClipButton.hidden = true;
  stopCamera(video);
  unloadVideoFile(video);
  try {
    const frame = await startCamera(video, deviceId);
    if (runToken !== sourceRunToken) return;
    frameSource = "camera";
    loadedClipName = null;
    measurementMode = "live";
    loadedClipDurationSeconds = null;
    fitCanvasTo(frame.widthPx, frame.heightPx);
    writeReadout(
      resolutionLabel,
      `Camera resolution: ${String(frame.widthPx)} x ${String(frame.heightPx)} pixels`,
    );
    resetSession();
    askKss("Before you begin: how sleepy do you feel?", (rating) => {
      kssBefore = rating;
    });
    setState({ kind: "running" });
    void ensureLandmarker();
  } catch (error: unknown) {
    if (runToken !== sourceRunToken) return;
    const name = error instanceof Error ? error.name : String(error);
    setState(classifyCameraError(name));
    return;
  }
  try {
    const options = cameraOptions(await listMediaDevices());
    if (runToken !== sourceRunToken) return;
    if (shouldShowPicker(options)) {
      populatePicker(options, deviceId);
      picker.hidden = false;
    }
  } catch {
    // Device listing failed. The camera still runs, the picker stays hidden.
  }
}

// A recorded clip through the same pipeline as the live camera. Same
// video element, same landmarker, same measurements, same CSV. The one
// thing that changes is the clock, and that is why frameSource exists.
//
// No KSS prompt here, unlike the camera path. Asking a person watching
// a recording how sleepy THEY feel would attach the wrong label to the
// wrong face. A clip's label belongs to whoever was recorded, and it
// comes from the dataset rather than from the viewer.
async function beginVideoFile(file: File): Promise<void> {
  sourceRunToken += 1;
  const runToken = sourceRunToken;
  setState({ kind: "requesting" });
  clipStopRequested = true;
  stopCamera(video);
  clipLoop?.stop();
  clipLoop = null;
  try {
    // Refuse rather than mislead. Without a per-decoded-frame callback
    // the only available clock is an interpolated currentTime, which
    // would make a 10 frame per second clip report the display's rate
    // and sail through the frame rate gate that exists to refuse
    // sources too coarse to see a blink. Wrong numbers are worse than
    // no numbers.
    if (!supportsVideoFrameCallback(video)) {
      throw new Error(
        "This browser cannot measure a clip accurately, because it cannot report individual video frames. Try Chrome, Edge or Safari. The live camera still works here.",
      );
    }

    const clip = await loadVideoFile(video, file);
    if (runToken !== sourceRunToken) return;
    frameSource = "file";
    loadedClipName = clip.name;
    loadedClipDurationSeconds = clip.durationSeconds;
    fitCanvasTo(clip.widthPx, clip.heightPx);
    const duration = Number.isFinite(clip.durationSeconds)
      ? `${clip.durationSeconds.toFixed(1)} s`
      : "unknown length";
    writeReadout(
      resolutionLabel,
      `Clip: ${clip.name}, ${String(clip.widthPx)} x ${String(clip.heightPx)} pixels, ${duration}`,
    );
    resetSession();
    setState({ kind: "running" });

    // Awaited, not fired and forgotten. The model takes seconds to
    // fetch and initialise, and the clip is still paused until it is
    // ready, so no part of the recording is consumed unmeasured.
    status.textContent = "Loading the model before the clip starts...";
    await ensureLandmarker();
    if (runToken !== sourceRunToken) return;
    status.textContent = "";

    if (stepToggle.checked) {
      // Stepped. The clip waits for the instrument on every frame, so
      // the output is a function of the file rather than of this
      // machine's speed. See issue #145.
      measurementMode = "stepped";
      // MediaPipe refuses a timestamp that goes backwards, and a clip's
      // media clock restarts at zero. So the clip's clock is lifted
      // above anything already sent. The offset is constant for the
      // whole clip, and the model reads the GAPS between timestamps
      // rather than their absolute value, so lifting them changes
      // nothing about the measurement while keeping it monotonic.
      clipModelClockBaseMs = Math.ceil(performance.now()) + 1;
      clipStopRequested = false;
      stopClipButton.hidden = false;
      const startedAtMs = performance.now();
      status.textContent = "Measuring every frame: 0 done.";
      const summary = await stepThroughVideo(
        video,
        ({ mediaTimeSeconds, index }) => {
          const nowMs = frameTimestampMs("file", 0, mediaTimeSeconds);
          const clockStep = acceptFrame(frameClock, nowMs);
          frameClock = clockStep.state;
          if (!clockStep.accepted) return;
          processFrame(nowMs, clipModelClockBaseMs + nowMs, index);
          // Every fifteenth frame, roughly twice a second of wall time.
          // Writing it on every frame costs a layout for a number
          // nobody can read that fast.
          if (index % 15 === 0) {
            status.textContent = steppingProgress(
              index + 1,
              mediaTimeSeconds,
              loadedClipDurationSeconds,
              performance.now() - startedAtMs,
            );
          }
        },
        // A newer source stops this run too: the flag alone is not
        // enough, because the newer run clears it for its own use.
        () => clipStopRequested || runToken !== sourceRunToken,
      );
      if (runToken !== sourceRunToken) return;
      stopClipButton.hidden = true;
      const tookSeconds = Math.round((performance.now() - startedAtMs) / 1000);
      // Deliberately NOT "measured every frame". The instrument cannot
      // know how many frames a file contains, only how many it looked
      // at, and the previous wording asserted the former from the
      // latter. It said "measured every frame: 6655 of them" about a
      // clip holding 12,626. Reporting the rate instead lets a person
      // check it against a clip they know: 60 here means 60 there.
      const rate =
        summary.frameIntervalSeconds === null
          ? "unknown rate"
          : `${(1 / summary.frameIntervalSeconds).toFixed(1)} frames per second`;
      if (summary.frameIntervalSeconds === null) {
        // The frame rate could not be established, so there is no
        // honest schedule to step on. Refusing beats the old fallback,
        // which assumed 60 fps and therefore visited every frame of a
        // 30 fps clip twice while reporting a perfectly ordinary
        // looking result.
        setState({
          kind: "clipFailed",
          reason:
            "Could not work out this clip's frame rate, so it cannot be measured frame by frame. Try re-saving it as a constant frame rate MP4.",
        });
        return;
      }
      if (summary.framesMeasured === 0) {
        // Zero is not a result, it is a failure, and reporting it in
        // the same sentence as a real measurement is the same
        // dishonesty as claiming every frame was measured. Safari did
        // exactly this on the owner's machine: "Measured 0 frames"
        // read like an outcome rather than the breakage it was.
        setState({
          kind: "clipFailed",
          reason:
            "No frames could be read from this clip. The file loaded, but seeking through it produced nothing. Try another browser, or re-save the clip as MP4.",
        });
        return;
      }
      // The stepper sought frames but the pipeline measured none.
      // This is a failure, not a result, and it must not fall through
      // to the summary below: review of remediation B1 showed that
      // path diagnosing it as "stepped at the wrong interval, frames
      // visited twice" and promising a correct exported file, every
      // clause false, while the export buttons sat disabled. The
      // likeliest cause, a model that never loaded, gets its named
      // degraded state in remediation B2; until then this refusal
      // says what is known and nothing more.
      if (framesMeasured === 0) {
        setState({
          kind: "clipFailed",
          reason:
            "This clip was read frame by frame, but not one frame was measured, so there is no result to report. The likeliest cause is that the measuring model never finished loading. Reload the page and try the clip again.",
        });
        return;
      }
      // Report the count that MEANS something. `summary.framesMeasured`
      // is how many frames the stepper sought to; `framesMeasured` is
      // how many the pipeline actually measured after duplicates were
      // rejected. They agree in a healthy run and diverge when the
      // calibrated interval is wrong, and printing the larger one told
      // the operator a comfortable number while hiding the fault. #193.
      const stepping = checkStepping(
        summary.framesMeasured,
        framesMeasured,
        loadedClipDurationSeconds,
      );
      const warning =
        stepping.kind === "ok" ? "" : ` ${steppingWarning(stepping)}`;
      // A clip where the gate never opened gets its own sentence. The
      // per-frame message is one line of body text and is invisible next
      // to a status line reading "Measured 3600 frames". #192.
      const refused =
        framesMeasured > 0 && framesBlinkMeasurable === 0
          ? ` ${clipRefusedMessage(
              loadedClipDurationSeconds !== null &&
                loadedClipDurationSeconds > 0
                ? framesMeasured / loadedClipDurationSeconds
                : null,
              framesMeasured,
            )}`
          : "";
      status.textContent = summary.stoppedEarly
        ? `Stopped after ${String(framesMeasured)} frames. Export the CSV to keep what was measured, or pick another clip.`
        : `Measured ${String(framesMeasured)} frames at ${rate}, in ${String(tookSeconds)} s. Check that rate against your clip. Export the CSV, or pick another clip.${warning}${refused}`;
      return;
    }

    // Watched. Nicer to look at, and honest about being partial: the
    // frame rate readout describes frames actually measured, and the
    // export records the mode so an analysis can tell the two apart.
    measurementMode = "played";
    clipLoop = startVideoFrameLoop(video, (mediaTimeSeconds) => {
      const nowMs = frameTimestampMs("file", 0, mediaTimeSeconds);
      const clockStep = acceptFrame(frameClock, nowMs);
      frameClock = clockStep.state;
      if (!clockStep.accepted) return;
      processFrame(nowMs, performance.now());
    });

    await video.play();
  } catch (error: unknown) {
    // A superseded run may not report either: its failure belongs to
    // a session that no longer exists, and the state is the new
    // run's to write.
    if (runToken !== sourceRunToken) return;
    frameSource = "camera";
    loadedClipName = null;
    clipLoop?.stop();
    clipLoop = null;
    const reason =
      error instanceof Error ? error.message : "That file could not be read.";
    setState({ kind: "clipFailed", reason });
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
// Invisible, and a permanent test contract like the data-testid
// handles in the calibration overlay: the end to end suite reads the
// frames-measured counter through it, because the counter is otherwise
// observable only in an exported CSV header. It starts EMPTY on
// purpose: the first processed frame writes "0", so a probe nobody
// writes reads as empty, never as a measured zero. Review caught the
// first version initialised to "0", where a dead wire and an honest
// zero were the same text.
const framesMeasuredProbe = document.createElement("span");
framesMeasuredProbe.hidden = true;
framesMeasuredProbe.setAttribute("data-testid", "frames-measured");
const earLabel = document.createElement("p");
const apertureLabel = document.createElement("p");

// The lean in, lean out experiment, live: both apertures' coefficient
// of variation over the last 10 seconds, side by side.
const stabilityLabel = document.createElement("p");
const headPoseLabel = document.createElement("p");
const gazeLabel = document.createElement("p");
const quadrantLabel = document.createElement("p");
const gazeStateLabel = document.createElement("p");
const fixationStatsLabel = document.createElement("p");

// The calibration capture screen: a dark overlay, one moving dot,
// click anywhere to cancel. A profile solved in an earlier visit
// survives in local storage and works from the first frame.
let calibrationProfile: CalibrationProfile | null = loadCalibrationProfile();
const calibrateButton = document.createElement("button");
calibrateButton.textContent =
  calibrationProfile === null ? "Calibrate gaze" : "Recalibrate gaze";
calibrateButton.disabled = true;
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
heatmapButton.disabled = true;
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
replayButton.disabled = true;
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
let blinkState = initialBlinkState;

const baselineLabel = document.createElement("p");
let baselineState: BaselineState | null = null;
let rateState: BlinkRateState | null = null;

const blinkShapeLabel = document.createElement("p");
blinkShapeLabel.hidden = true;
const perclosLabel = document.createElement("p");
let perclosState = emptyPerclos();
const longClosureLabel = document.createElement("p");
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
alertBanner.className = "alert";
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
kssPrompt.className = "kss-prompt";
const kssButtons = document.createElement("div");
kssButtons.className = "kss-grid";
kssPanel.append(kssPrompt, kssButtons);

function askKss(
  question: string,
  onAnswer: (r: KssRating | null) => void,
): void {
  kssPrompt.textContent = question;

  // The answer stays on screen after choosing, as a single disabled
  // button. It goes into the exported file, so being able to see what
  // you actually answered is part of trusting the data. Hiding it
  // leaves you with a number in a CSV and no memory of the question.
  const settle = (label: string): void => {
    const answered = document.createElement("button");
    answered.className = "kss-option";
    answered.textContent = label;
    answered.disabled = true;
    kssButtons.replaceChildren(answered);
  };

  const choose = (rating: KssRating | null): void => {
    const step = KSS_SCALE.find((s) => s.rating === rating);
    settle(
      step === undefined ? "Skipped" : `${String(step.rating)} ${step.label}`,
    );
    onAnswer(rating);
  };

  kssButtons.replaceChildren(
    ...KSS_SCALE.map((step) => {
      const button = document.createElement("button");
      button.className = "kss-option";
      // The published wording, never abbreviated. "6" means nothing
      // without "Some signs of sleepiness", so a dropdown that hides
      // the anchors would change what the scale measures.
      button.textContent = `${String(step.rating)} ${step.label}`;
      button.addEventListener("click", () => {
        choose(step.rating);
      });
      return button;
    }),
  );
  const skip = document.createElement("button");
  skip.className = "kss-option skip";
  skip.textContent = "Skip";
  skip.addEventListener("click", () => {
    choose(null);
  });
  kssButtons.append(skip);
  kssPanel.hidden = false;
}

function exportSession(): void {
  const csv = serializeRecords(featureRecords, [
    ...sourceMetadataRows(frameSource, loadedClipName),
    ...coverageMetadataRows(
      measurementMode,
      framesMeasured,
      loadedClipDurationSeconds,
    ),
    ...kssMetadataRows(kssBefore, kssAfter),
  ]);
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
exportButton.setAttribute("data-testid", "export-csv");
exportButton.disabled = true;
exportButton.disabled = true;
// A second export, and a separate one on purpose. The per-second file
// answers "what were the eyes doing during this second". This one
// answers "when did each blink happen". Squeezing events into a
// per-second table loses every blink after the first in any given
// second, and at a resting rate of fifteen a minute that is not rare.
//
// The frame numbers are why this exists at all. A human annotator marks
// blinks BY FRAME, so any comparison against ground truth has to happen
// in frames. Milliseconds cannot substitute: our clock and theirs agree
// only if the frame rate is exactly what both assumed.
const exportBlinksButton = document.createElement("button");
exportBlinksButton.textContent = "Export blink log";
exportBlinksButton.disabled = true;
exportBlinksButton.setAttribute("data-testid", "export-blinks");
exportBlinksButton.addEventListener("click", () => {
  const csv = serialiseBlinkEvents(
    blinkEvents,
    [
      ...sourceMetadataRows(frameSource, loadedClipName),
      ...coverageMetadataRows(
        measurementMode,
        framesMeasured,
        loadedClipDurationSeconds,
      ),
    ],
    // The detector's own count, handed over so the file can compare it
    // against its own rows and say so if any are missing. Nothing here
    // trusts the row count to be the blink count.
    blinkState.blinkCount,
  );
  if (csv === null) return;
  const stamp = new Date(sessionStartedAtEpochMs ?? Date.now())
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  downloadTextFile(`blinklab-blinks-${stamp}.csv`, csv, "text/csv");
});

exportButton.addEventListener("click", () => {
  // The after answer is asked once, on the first export, so the
  // question arrives when the session is actually over rather than
  // interrupting it.
  // Never on a clip. The camera path already skips the "before"
  // question for this reason and the "after" question was missed:
  // asking whoever is watching a recording how sleepy THEY feel would
  // write the viewer's answer into the file as the recorded person's
  // label, which is the exact mislabelling a dataset exists to avoid.
  if (kssAfter === null && frameSource === "camera") {
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
scoreLabel.style.fontWeight = "bold";
// The 6.6 contribution panel: the score's own arithmetic, shown.
const panelSummaryLabel = document.createElement("p");
const panelList = document.createElement("ul");
panelList.setAttribute("aria-label", "Score contributions");
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
blinkLogList.className = "blink-log";
blinkLogList.setAttribute("aria-label", "Blink events");
blinkLogList.style.maxHeight = "160px";
blinkLogList.style.overflowY = "auto";
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

// Tuned when the displayed ratio read about 0.5; since the 11 August
// 2026 coordinate fix an open eye sits near 0.28, so the trace rides
// the lower half of this scale. Kept for now: rescaling the chart is a
// display decision, not part of fixing the measurement, and a blink
// valley is still unmistakable at half height.
const SPARK_EAR_MAX = 0.6;
const sparkCanvas = document.createElement("canvas");
sparkCanvas.width = 640;
sparkCanvas.height = 56;
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
  traceCanvas.height = 40;
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

// Set when a clip starts. See the comment at the assignment.
let clipModelClockBaseMs = 0;

let frameTimestampsMs: number[] = [];
let inferenceSamplesMs: number[] = [];

// One frame, already accepted by the clock. nowMs is the pipeline's
// clock: the wall clock live, the clip's own media time for a file.
//
// modelClockMs is the number handed to MediaPipe, and it is separate
// because MediaPipe needs one that only ever increases, even across a
// change of source. It used to be `performance.now()` in every mode,
// on the stated belief that MediaPipe "uses it only to order frames
// internally". That belief was wrong and it cost this project its
// repeatability. In VIDEO running mode the model tracks a face from
// frame to frame, and the GAP between timestamps is part of how it
// does that. Handing it the wall clock while stepping a file fed the
// speed of the computer straight into the measurement, which is the
// exact dependence stepping exists to remove: every frame was
// measured, but each frame was measured slightly differently
// depending on how busy the machine was that second.
//
// Measured on 9 August 2026: three runs of one clip on one machine
// gave the same 43 detections with three different sets of blink
// timings. See issue #174.
function processFrame(
  nowMs: number,
  modelClockMs: number,
  // Which frame of the source this is. A clip counts from zero and the
  // number means something to an annotator; a camera counts frames
  // since the session began and it means nothing to anyone, which is
  // why it is written to the blink log only for clips.
  frameIndex: number | null = null,
): void {
  currentFrameIndex = frameIndex;
  frameTimestampsMs.push(nowMs);
  frameTimestampsMs = keepRecent(frameTimestampsMs, nowMs, 2000);
  const fps = measureFps(frameTimestampsMs);
  // Only while a session runs. Off duty this loop is still ticking at
  // the DISPLAY's refresh rate, and printing that as the instrument's
  // frame rate is a wrong number rather than a missing one.
  writeReadout(
    fpsLabel,
    state.kind !== "running"
      ? ""
      : fps === null
        ? "Frames per second: measuring..."
        : `Frames per second: ${String(Math.round(fps))}`,
  );

  if (state.kind === "running" && canvasContext !== null) {
    const transform = frameTransform(mirrored, canvas.width);
    drawVideoFrame(canvasContext, video, transform);

    if (landmarker !== null) {
      const inferenceStartMs = performance.now();
      // MediaPipe wants a strictly increasing clock of its own, and
      // uses it only to order frames internally. The wall clock is
      // always that, and it survives a switch from camera to file,
      // which a media clock restarting at zero would not.
      const result = landmarker.detectForVideo(video, modelClockMs);
      // Counted HERE, behind the running-session, canvas and
      // landmarker conditions and AFTER the model call returned, and
      // the placement is what the number means. This counter is
      // written into the export header as frames_measured, and a
      // frame is measured only when the model actually processed it.
      // At the top of this function the counter ticked at display
      // rate from the moment a camera session began, while the model
      // was still seconds away from existing, so a cold start wrote
      // thousands of phantom frames into the header of an otherwise
      // honest file. Counting after the call also keeps a frame the
      // model throws on out of the count. Remediation B1.
      framesMeasured += 1;
      inferenceSamplesMs = pushSample(
        inferenceSamplesMs,
        performance.now() - inferenceStartMs,
        60,
      );
      writeReadout(
        inferenceLabel,
        inferenceMessage(meanDurationMs(inferenceSamplesMs)),
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
        writeReadout(
          headPoseLabel,
          pose === null
            ? "Head pose: no valid measurement"
            : `Head pose, pitch: ${pose.pitchDeg.toFixed(0)}°, yaw: ${pose.yawDeg.toFixed(0)}°, roll: ${pose.rollDeg.toFixed(0)}°`,
        );
        const gate = poseValidity(pose);
        gateLabel.textContent = poseValidityMessage(gate);

        if (gate.kind === "valid") {
          const rightEye = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
          const leftEye = eyeLandmarksFromFace(face, LEFT_EYE_EAR_INDICES);
          const rightEar =
            rightEye === null
              ? null
              : eyeAspectRatio(rightEye, canvas.width, canvas.height);
          const leftEar =
            leftEye === null
              ? null
              : eyeAspectRatio(leftEye, canvas.width, canvas.height);
          writeReadout(
            earLabel,
            rightEar === null || leftEar === null
              ? "Eye aspect ratio: no valid measurement"
              : `Eye aspect ratio, right: ${rightEar.toFixed(2)}, left: ${leftEar.toFixed(2)}`,
          );
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
          writeReadout(
            apertureLabel,
            rightMm === null || leftMm === null
              ? "Eyelid aperture: no valid measurement"
              : `Eyelid aperture, right: ${rightMm.toFixed(1)} mm, left: ${leftMm.toFixed(1)} mm`,
          );

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
          writeReadout(
            gazeLabel,
            rightOffset === null || leftOffset === null
              ? "Iris offset: no valid measurement"
              : `Iris offset, right: ${fmt(rightOffset.horizontal)} / ${fmt(rightOffset.vertical)}, left: ${fmt(leftOffset.horizontal)} / ${fmt(leftOffset.vertical)}`,
          );

          const meanOffset = meanIrisOffset(rightOffset, leftOffset);
          frameMeanOffset = meanOffset;
          frameOnScreen = meanOffset === null ? null : isOnScreen(meanOffset);
          writeReadout(quadrantLabel, lookingTowardMessage(meanOffset));
        } else {
          // The gate refused: numbers pause, the gap is honest, the
          // pose stays visible so you can see your way back.
          writeReadout(earLabel, "Eye aspect ratio: no valid measurement");
          writeReadout(apertureLabel, "Eyelid aperture: no valid measurement");
          writeReadout(gazeLabel, "Iris offset: no valid measurement");
          writeReadout(quadrantLabel, "Looking toward: no valid measurement");
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

        // The mesh draws first so the eye markers, which are the ones
        // you actually read, sit on top of it rather than under.
        if (showFaceMesh) {
          drawDots(canvasContext, project(face), 1, "rgba(120, 144, 156, 0.7)");
        }

        if (showEyeMarkers) {
          const eyelidDots = project(
            pickPoints(face, [...RIGHT_EYE_INDICES, ...LEFT_EYE_INDICES]),
          );
          drawDots(canvasContext, eyelidDots, 1, "#ffffff");

          const irisColor = "#ff9100";
          // A circle fitted to the four boundary points, not a polygon
          // through them. Four points joined up draw a diamond, which
          // is what was on screen and which nobody chose.
          for (const [ring, centerIndex] of [
            [RIGHT_IRIS_RING_INDICES, RIGHT_IRIS_CENTER_INDEX],
            [LEFT_IRIS_RING_INDICES, LEFT_IRIS_CENTER_INDEX],
          ] as const) {
            const center = project(pickPoints(face, [centerIndex]))[0];
            if (center === undefined) continue;
            drawFittedCircle(
              canvasContext,
              center,
              project(pickPoints(face, ring)),
              1.5,
              irisColor,
            );
          }
          const centers = project(
            pickPoints(face, [RIGHT_IRIS_CENTER_INDEX, LEFT_IRIS_CENTER_INDEX]),
          );
          drawDots(canvasContext, centers, 1.5, irisColor);
        }
      } else {
        // No face: the numbers must vanish, not go stale.
        writeReadout(earLabel, "Eye aspect ratio: no valid measurement");
        writeReadout(apertureLabel, "Eyelid aperture: no valid measurement");
        writeReadout(headPoseLabel, "Head pose: no valid measurement");
        writeReadout(gazeLabel, "Iris offset: no valid measurement");
        writeReadout(quadrantLabel, "Looking toward: no valid measurement");
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
        withinWindow(
          [
            ...samples,
            {
              timestampMs: nowMs,
              value: offset === null ? null : GAZE_TRACE_HALF - offset[axis],
            },
          ],
          nowMs,
          SPARK_WINDOW_MS,
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
        writeReadout(gazeStateLabel, "Gaze state: no valid measurement");
        writeReadout(
          fixationStatsLabel,
          "Fixations in the last 10 s: none yet",
        );
      } else {
        gazeSamples = withinWindow(
          [
            ...gazeSamples,
            { timestampMs: nowMs, offset: smoothedGaze.smoothed },
          ],
          nowMs,
          SPARK_WINDOW_MS,
        );
        const fixations = detectFixations(gazeSamples);
        const lastFixation = fixations[fixations.length - 1];
        // Fixating right now means the newest fixation reaches the
        // newest sample. "Moving" covers a saccade in flight and the
        // first not-yet-long-enough moments of the next stillness.
        writeReadout(
          gazeStateLabel,
          lastFixation !== undefined && lastFixation.endMs === nowMs
            ? `Gaze state: fixating for ${((lastFixation.endMs - lastFixation.startMs) / 1000).toFixed(1)} s`
            : "Gaze state: moving",
        );

        // The statistics include the still-growing fixation at its
        // length so far: a panel that waits for the end lags the eye.
        const stats = fixationStats(fixations);
        frameFixationStats = stats;
        frameFixating =
          lastFixation !== undefined && lastFixation.endMs === nowMs;
        writeReadout(
          fixationStatsLabel,
          stats === null
            ? "Fixations in the last 10 s: none yet"
            : `Fixations in the last 10 s: ${String(stats.count)}, duration mean ${stats.meanMs.toFixed(0)} ms, median ${stats.medianMs.toFixed(0)} ms, longest ${stats.longestMs.toFixed(0)} ms`,
        );
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

      earSamples = withinWindow(
        [...earSamples, { timestampMs: nowMs, value: meanEar }],
        nowMs,
        SPARK_WINDOW_MS,
      );

      baselineState = baselineStep(
        baselineState ?? startBaseline(nowMs),
        nowMs,
        stabilityMm,
      );
      const personalMm = personalThresholdMm(baselineState);
      const secondsLeft = learningSecondsLeft(baselineState, nowMs);
      writeReadout(
        baselineLabel,
        baselineState.kind === "ready" && personalMm !== null
          ? `Personal blink threshold: ${personalMm.toFixed(1)} mm (half of your ${baselineState.baselineMm.toFixed(1)} mm baseline)`
          : `Learning your open eyes: ${String(secondsLeft ?? 0)} s left`,
      );

      const blinkCountBefore = blinkState.blinkCount;
      const wasOpen = blinkState.eye !== "closed";
      const blinkMeasurable = measurableAtFps(fps);
      if (blinkMeasurable) framesBlinkMeasurable += 1;
      blinkState = blinkStep(
        blinkState,
        nowMs,
        blinkMeasurable ? stabilityMm : null,
        personalMm ?? BLINK_APERTURE_THRESHOLD_MM,
      );
      rateState ??= startRate(nowMs);
      if (wasOpen && blinkState.eye === "closed") {
        closureStartFrame = currentFrameIndex;
      }
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
          writeReadout(
            blinkShapeLabel,
            `Last blink shape: amplitude ${shape.amplitudeMm.toFixed(1)} mm, peak closing ${shape.peakClosingVelocityMmPerS.toFixed(0)} mm/s, A/V ${shape.amplitudeOverVelocityMs.toFixed(0)} ms`,
          );
        }

        sessionStartMs ??= nowMs;
        blinkEvents = appendEvent(blinkEvents, {
          atMs: nowMs,
          durationMs: blinkState.lastBlinkDurationMs ?? 0,
          shape,
          startFrame: closureStartFrame,
          endFrame: currentFrameIndex,
        });
        closureStartFrame = null;
        blinkLogList.replaceChildren(
          // The list shows a tail. The record above it keeps everything.
          ...[...eventsForDisplay(blinkEvents)].reverse().map((event) => {
            const item = document.createElement("li");
            item.textContent = formatBlinkEvent(event, sessionStartMs ?? 0);
            return item;
          }),
        );
      }
      if (!blinkMeasurable) {
        writeReadout(blinkLabel, fpsGateMessage(fps));
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
        writeReadout(
          blinkLabel,
          `${parts[0] ?? ""} (${parts.slice(1).join(", ")})`,
        );
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
        writeReadout(
          longClosureLabel,
          "Long closures: waiting for the baseline",
        );
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
        writeReadout(
          longClosureLabel,
          longClosureParts.length > 1
            ? `${longClosureParts[0] ?? ""} (${longClosureParts.slice(1).join(", ")})`
            : (longClosureParts[0] ?? ""),
        );
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
      writeReadout(
        perclosLabel,
        perclos === null
          ? "PERCLOS (eyes closed share, last 60 s): measuring..."
          : `PERCLOS (eyes closed share, last 60 s): ${(perclos * 100).toFixed(1)}%`,
      );

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
        exportBlinksButton.disabled = blinkEvents.length === 0;
        writeReadout(
          featureLabel,
          featureRecords.length >= 3600
            ? "Feature records: last 3600 kept, oldest discarded (about one per second)"
            : `Feature records: ${String(featureRecords.length)} this session (about one per second)`,
        );

        // The score reads the last minute of rows, selected by
        // TIMESTAMP inside core: a row-count window would bridge a
        // paused tab's gap and charge closures from ten minutes ago.
        const breakdown = scoreRecords(featureRecords);
        const noFaceNow =
          featureRecords[featureRecords.length - 1]?.faceDetected;
        // The number and its caveat are separated into two lines, one
        // large and one small, rather than run together in one long
        // sentence where neither reads. Increment 6.9's rule was that
        // the caveat travels WITH the number so a screenshot cannot
        // separate them, and directly beneath in smaller type honours
        // that while letting the number actually be the headline.
        writeReadout(
          scoreLabel,
          breakdown !== null
            ? `Alertness score: ${String(breakdown.score)} / 100`
            : noFaceNow === false
              ? "Alertness score: no face in frame"
              : "Alertness score: measuring...",
        );

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

      stabilitySamples = withinWindow(
        [
          ...stabilitySamples,
          { timestampMs: nowMs, px: stabilityPx, mm: stabilityMm },
        ],
        nowMs,
        SPARK_WINDOW_MS,
      );
      const pxSeries = stabilitySamples
        .map((sample) => sample.px)
        .filter((value): value is number => value !== null);
      const mmSeries = stabilitySamples
        .map((sample) => sample.mm)
        .filter((value): value is number => value !== null);
      const cvPx = coefficientOfVariation(pxSeries);
      const cvMm = coefficientOfVariation(mmSeries);
      writeReadout(
        stabilityLabel,
        cvPx === null || cvMm === null
          ? "Aperture stability: measuring..."
          : `Aperture stability over 10 s, px CV: ${(cvPx * 100).toFixed(1)}%, mm CV: ${(cvMm * 100).toFixed(1)}%`,
      );
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
  // The probe is written LAST, outside every guard above, so it holds
  // the exact count after this frame, wherever the increment sits.
  // Written at the top it lagged one frame behind, and after a
  // stepped clip's final frame nothing ticks again, so the lag froze
  // into the reading: a 60 frame clip showed 59, forever.
  framesMeasuredProbe.textContent = String(framesMeasured);
}

// The graph strip sits at the very top and spans the whole window,
// so one screenshot of the top of the page carries the traces plus
// as many readouts as fit underneath.
// Canvases are inline by default, which leaves whitespace gaps
// between them, but an inline display style would beat the `hidden`
// attribute and show three empty strips before the camera starts.
// A stylesheet rule stacks them AND keeps hidden meaning hidden.
const graphStyles = document.createElement("style");
graphStyles.textContent =
  ".graph { display: block; } .graph[hidden] { display: none; }" +
  // The body's default margin leaves a strip down each side, so the
  // full width strip and the notice fall short of the window edge.
  // The centred column keeps its own padding so it stays readable
  // on a narrow window once the body margin is gone.
  // An explicit background and text colour, which the page never had.
  // Without them the browser paints its own canvas from the viewer's
  // system theme while the text stays black, so on a machine set to
  // dark mode the whole page rendered black on black. Nobody noticed
  // for six phases because it was just legible enough to squint at.
  //
  // Fixed rather than made theme-aware on purpose: this page's job
  // includes being screenshotted and filmed, and a demo that looks
  // different depending on the viewer's settings is a demo you cannot
  // reason about.
  " body { margin: 0; background: #ffffff; color: #1a1a1a;" +
  "   font-family: system-ui, -apple-system, sans-serif;" +
  "   font-size: 14px; }" +
  // The box system. Three tiers, and the tiers are the point: the
  // score is the claim, the measurements are the evidence, and the
  // instrument's own health is neither. Before this every readout had
  // the same visual weight, so a stranger could not tell in two
  // seconds which number the project is actually about.
  //
  // Rules live here rather than in inline styles because an inline
  // `display` beats the `hidden` attribute, which is how three empty
  // canvases once appeared above an unstarted page.
  " .box { border: 1px solid #d4d4d4; border-radius: 8px;" +
  "   padding: 12px 16px; margin: 0; background: #fbfbfb; }" +
  " .box[hidden] { display: none; }" +
  // Every gap on the page comes from a container, never from a box's
  // own margin, so there is exactly one number to change.
  " #content { display: flex; flex-direction: column; gap: 16px;" +
  "   padding-bottom: 16px; }" +
  // One rule for every full width strip on the page: the top bar, the
  // status banner's wrapper, the boxes, and the footer. They line up
  // with each other because they are the same rule, not because four
  // numbers were kept in step by hand.
  //
  // The side padding is a gutter for narrow windows, not decoration.
  // Once the window is wide enough to show the whole 1280 column AND a
  // 16 pixel gutter either side, `margin: auto` is already providing
  // that space, so the padding is doing nothing except making the
  // column narrower than it says it is. Above 1312 pixels, which is
  // 1280 plus both gutters, it is therefore removed and the boxes get
  // the full 1280.
  " .page-column { max-width: 1280px; margin-left: auto;" +
  "   margin-right: auto; box-sizing: border-box;" +
  "   padding-left: 16px; padding-right: 16px; }" +
  " @media (min-width: 1312px) {" +
  "   .page-column { padding-left: 0; padding-right: 0; } }" +
  // The name is the only h1 on the page and the browser's default
  // 0.67em margin on it, not the bar's padding, was most of why the top
  // bar stood 99 pixels tall. Sized here so the bar's height is a
  // decision rather than a leftover.
  " .page-column > h1 { font-size: 22px; line-height: 1.3;" +
  "   margin: 14px 0; }" +
  // The page ends on a line rather than on nothing. Border only, no
  // fill, because a filled bar would read as a second banner.
  " #page-footer { border-top: 1px solid #e4e4e4; background: #ffffff;" +
  "   padding-top: 12px; padding-bottom: 12px; }" +
  " #page-footer p { margin: 0; font-size: 12px; color: #666;" +
  "   text-align: center; }" +
  " .box > h2 { font-size: 12px; text-transform: uppercase;" +
  "   letter-spacing: 0.08em; color: #666; margin: 0 0 8px 0;" +
  "   font-weight: 600; }" +
  " .box p { margin: 4px 0; }" +
  // Tier 2 sits three across on a wide window and stacks on a narrow
  // one. auto-fit with a minimum keeps that behaviour without a media
  // query having to guess a breakpoint.
  " .row { display: grid; gap: 16px;" +
  "   grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));" +
  "   align-items: start; }" +
  // display:grid beats the `hidden` attribute, exactly as an inline
  // display would, so hidden has to be restored explicitly.
  " .row[hidden] { display: none; }" +
  // The headline. The only large type on the page.
  " .headline { font-size: 26px; font-weight: 700; margin: 0 0 6px 0;" +
  "   line-height: 1.25; }" +
  // Tier 3 is deliberately quieter than the measurements above it.
  " .quiet { font-size: 12px; color: #555; }" +
  " .quiet p { margin: 2px 0; }" +
  " .caveat { font-size: 12px; color: #666; margin: 0 0 10px 0; }" +
  // Source takes the wider side because it holds the video, which is
  // sized to 640 px. An even split of a 1280 column leaves about 630
  // per side once the gap is taken, which would shrink the picture.
  " .top-row { display: grid; gap: 16px; align-items: stretch;" +
  "   grid-template-columns: 55fr 45fr; }" +
  " .top-row[hidden] { display: none; }" +
  // Below this the columns stack, and Source comes first because
  // nothing else on the page does anything until a source is running.
  " @media (max-width: 900px) { .top-row { grid-template-columns: 1fr; } }" +
  // Boxes in one row match height. A tall blink log therefore stretches
  // its neighbours rather than leaving a ragged edge.
  " .row > .box { height: 100%; box-sizing: border-box; }" +
  " .button-row { display: flex; flex-wrap: wrap; gap: 8px;" +
  "   margin-top: 8px; }" +
  " .signals-footer { display: flex; flex-wrap: wrap; gap: 16px;" +
  "   align-items: center; justify-content: space-between;" +
  "   margin-top: 8px; }" +
  " .legend { display: flex; flex-wrap: wrap; gap: 14px;" +
  "   font-size: 12px; color: #555; }" +
  " .legend-item { display: inline-flex; align-items: center; gap: 6px; }" +
  " .swatch { width: 10px; height: 10px; border-radius: 50%;" +
  "   display: inline-block; }" +
  " .instrument-line { display: flex; gap: 16px; font-size: 12px;" +
  "   color: #555; }" +
  " .instrument-line p { margin: 0; }" +
  // The alert is a detected EVENT, not a judgement about a person, so
  // it is allowed to be loud in a way the score deliberately is not.
  " .alert { border-left: 3px solid #c62828; padding-left: 10px; }" +
  // The banner carries no padding of its own and its children carry
  // their own margins, so when every child is empty the whole strip
  // collapses to nothing without anyone having to remember to hide it.
  // This replaced a computed hidden flag that went stale: status text
  // is written from a dozen places that do not call render(), so the
  // banner stayed invisible while the app was talking.
  // The strip is always there, bordered like every other section, so
  // an arriving alert changes its colour rather than the page's height.
  // Centred in EVERY state, not only when idle. The strip holds four
  // different children and they used to disagree with each other, so
  // the line moved sideways depending on what the app happened to be
  // saying. A bar that shifts as it speaks reads as a layout fault.
  // The bottom margin is the same 16 the boxes use between themselves,
  // because without it the strip sat directly on top of Source.
  " #status-banner { border: 1px solid #d4d4d4; border-radius: 8px;" +
  "   background: #fff; padding: 10px 16px; margin: 16px auto 16px auto;" +
  "   text-align: center; }" +
  " #status-banner > p { margin: 0; }" +
  " #status-banner > p:empty { display: none; }" +
  " #status-banner.alerting { background: #ffb300; border-color: #ef6c00; }" +
  // Inside an orange strip the red rule is invisible and unnecessary.
  " #status-banner.alerting .alert { border-left: none; padding-left: 0;" +
  "   font-weight: 600; }" +
  // The sleepiness options, one per row. Option 9 is 54 characters and
  // will not share a line with anything.
  " .kss-prompt { font-weight: 600; margin: 8px 0 6px 0; }" +
  " .kss-grid { display: grid; gap: 6px;" +
  "   grid-template-columns: repeat(2, minmax(0, 1fr)); }" +
  " .kss-option { text-align: left; width: 100%; }" +
  // Skip used to span the whole row, which put it below rating 9 and
  // gave it more visual weight than any of the ratings it is not one
  // of. Nine ratings in two columns leave the second column of the
  // last row empty, so an ordinary cell drops Skip exactly there,
  // directly under rating 8, filling the hole rather than adding a
  // row.

  // 7. Bullets indented every blink and pushed most of them onto two
  // lines. The list is already visually a list.
  " .blink-log { list-style: none; padding: 0; margin: 8px 0 0 0;" +
  "   max-height: 190px; overflow-y: auto; font-size: 12px; }" +
  " .blink-log li { margin: 2px 0; }" +
  // 8. Labels stay light, the measurements are bold. Split at the first
  // colon at render time rather than in the message functions, so the
  // tested strings in core are untouched.
  " .value { font-weight: 600; }" +
  // 9. Boxes hold their height as content changes, so the page does not
  // jump every time a readout gains or loses a line. They can still
  // grow past it; this is a floor, not a ceiling.
  " .top-row .box { min-height: 132px; }" +
  // The right column is a flex column and Session takes the slack, so
  // its bottom edge meets Source's however tall the video makes that.
  " .stack { display: flex; flex-direction: column; gap: 16px;" +
  "   height: 100%; }" +
  " .stack > :last-child { flex: 1; }" +
  " .row .box { min-height: 230px; }" +
  " #live-signals { min-height: 210px; }" +
  // 2. Native form controls render differently in every browser, which
  // is what made Chrome and Safari look like different products. This
  // is not a design system, it is the cheap 90 per cent of one: one
  // accent colour and one button shape, no dependency.
  " input[type=checkbox] { accent-color: #1a73e8; width: 14px;" +
  "   height: 14px; margin: 0 6px 0 0; vertical-align: -2px; }" +
  " button { font: inherit; font-size: 13px; padding: 5px 12px;" +
  "   border: 1px solid #c6c6c6; border-radius: 6px; background: #fff;" +
  "   color: #1a1a1a; cursor: pointer; }" +
  " button:hover:not(:disabled) { background: #f2f2f2; }" +
  " button:disabled { color: #9a9a9a; background: #f5f5f5;" +
  "   cursor: default; }" +
  " label { font-size: 14px; }";
document.head.append(graphStyles);

const graphStrip = document.createElement("div");
graphStrip.append(
  sparkCanvas,
  gazeTraceHorizontalCanvas,
  gazeTraceVerticalCanvas,
);

// Everything else lives in one centred column. On a wide monitor the
// readouts used to hug the far left, which meant reading them turned
// the head while the instrument was measuring; 1280 pixels brings
// them near the middle, where the gaze angle is small.
const contentBox = document.createElement("div");
contentBox.id = "content";
contentBox.className = "page-column";
// The mirror toggle and the resolution readout share one line: both
// describe the camera feed, and separating them cost a whole row.
const cameraLine = document.createElement("div");
Object.assign(cameraLine.style, {
  flexWrap: "wrap",
  display: "flex",
  gap: "16px",
  alignItems: "baseline",
});
cameraLine.append(mirrorLabel, eyeMarkerLabel, faceMeshLabel, resolutionLabel);

// The boxes. Each one answers a different question, and grouping them
// is what lets a stranger read the page without being told where to
// look. Assembling them here, in one place, also means the page's
// structure is legible in the source rather than scattered.
function box(heading: string, ...children: Element[]): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "box";
  const title = document.createElement("h2");
  title.textContent = heading;
  element.append(title, ...children);
  return element;
}

// Always present, never conditional, never dismissible. It sits inside
// the same box as the number so a screenshot of one carries the other.

// The two exports and the development-only fixture recorder share a
// row rather than stacking, since they are all "take something away
// with you".
const exportRow = document.createElement("div");
exportRow.className = "button-row";
exportRow.append(
  exportButton,
  exportBlinksButton,
  ...(recorder !== null ? [recorder.button] : []),
);

const gazeButtonRow = document.createElement("div");
gazeButtonRow.className = "button-row";
gazeButtonRow.append(calibrateButton, heatmapButton, replayButton);

// The legend, because three coloured lines with no key are decoration
// rather than information. Grey always means raw and orange always
// means smoothed across both gaze traces, so three entries covers five
// lines honestly.
function legendItem(colour: string, text: string): HTMLSpanElement {
  const item = document.createElement("span");
  item.className = "legend-item";
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = colour;
  item.append(swatch, document.createTextNode(text));
  return item;
}

const legend = document.createElement("div");
legend.className = "legend";
legend.append(
  legendItem("#00b0ff", "Eye aspect ratio"),
  legendItem("#546e7a", "Gaze, raw"),
  legendItem("#ff9100", "Gaze, smoothed"),
);

const instrumentLine = document.createElement("div");
instrumentLine.className = "instrument-line";
instrumentLine.append(fpsLabel, inferenceLabel, framesMeasuredProbe);

const signalsFooter = document.createElement("div");
signalsFooter.className = "signals-footer";
signalsFooter.append(legend, instrumentLine);

const sourceBox = box(
  "Source",
  startButton,
  clipLabel,
  stepLabel,
  stopClipButton,
  picker,
  canvas,
  cameraLine,
);

const alertnessBox = box("Alertness", scoreLabel, panelSummaryLabel, panelList);
scoreLabel.className = "headline";

const sessionBox = box("Session", featureLabel, exportRow, kssPanel);

const blinksBox = box(
  "Blinks",
  blinkLabel,
  baselineLabel,
  blinkShapeLabel,
  blinkLogList,
);

const eyesBox = box(
  "Eyes",
  apertureLabel,
  earLabel,
  stabilityLabel,
  perclosLabel,
  longClosureLabel,
);

// Head pose and the pose gate live with gaze rather than with the
// instrument readouts, because they explain why the gaze lines above
// them go quiet. Next to "frames per second" they would explain
// nothing.
const gazeBox = box(
  "Gaze",
  gazeLabel,
  quadrantLabel,
  gazeStateLabel,
  fixationStatsLabel,
  headPoseLabel,
  gateLabel,
  gazeButtonRow,
);

// The live traces, plus the two numbers describing how well they are
// being captured. Frame rate and inference time are not measurements
// of the eyes, but they ARE measurements of the signal on this strip,
// so they belong beside it rather than in a box of their own.
const liveSignalsBox = box("Live signals", graphStrip, signalsFooter);

// Source sits in the wider column because it holds the video, which is
// sized to 640 px. An even split of a 1280 column leaves about 630 per
// side once the gap is taken, which would shrink the picture.
const topRow = document.createElement("div");
topRow.className = "top-row";
const rightColumn = document.createElement("div");
rightColumn.className = "stack";
rightColumn.append(alertnessBox, sessionBox);
topRow.append(sourceBox, rightColumn);

liveSignalsBox.id = "live-signals";

const measurementRow = document.createElement("div");
measurementRow.className = "row";
measurementRow.append(gazeBox, eyesBox, blinksBox);

contentBox.append(topRow, liveSignalsBox, measurementRow);

// The graph canvases carry their own pixel buffers, and the drawing
// code reads canvas.width for its coordinates, so widening the buffer
// genuinely redraws at that width instead of stretching a 640 pixel
// image across the space.
//
// Sized to the box rather than the window now. The traces used to span
// the whole window so one screenshot of the top of the page carried
// them plus the readouts; with the boxed layout the top of the page
// carries the score, the source and the video instead, which is a
// better screenshot, and the traces are supporting evidence further
// down. The cost is fewer pixels per second of history, which over a
// ten second window does not matter.
function sizeGraphsToBox(): void {
  // Measured from the BOX's content width, not the column's. The
  // strip has no width of its own, so falling back to the column gave
  // a buffer wider than the space it is drawn into, and the trace ran
  // off the left edge.
  const available = liveSignalsBox.clientWidth;
  const style = window.getComputedStyle(liveSignalsBox);
  const inner =
    available -
    parseFloat(style.paddingLeft || "0") -
    parseFloat(style.paddingRight || "0");
  const width = Math.max(320, Math.floor(inner || 1200));
  for (const graph of [
    sparkCanvas,
    gazeTraceHorizontalCanvas,
    gazeTraceVerticalCanvas,
  ]) {
    if (graph.width !== width) {
      graph.width = width;
    }
    graph.style.width = "100%";
    graph.classList.add("graph");
  }
}

// Every readout starts with the same sentence it will show when a
// measurement is refused, so the page at idle looks like the page
// running, minus the numbers. The line count never changes as values
// arrive, which is what stops the layout reflowing through the first
// minute while somebody is deciding whether to trust it.
for (const [element, initial] of [
  [scoreLabel, "Alertness score: measuring..."],
  [panelSummaryLabel, "Nothing is costing points."],
  [earLabel, "Eye aspect ratio: no valid measurement"],
  [apertureLabel, "Eyelid aperture: no valid measurement"],
  [stabilityLabel, "Aperture stability: measuring..."],
  [perclosLabel, "PERCLOS (eyes closed share, last 60 s): measuring..."],
  [longClosureLabel, "Long closures: waiting for the baseline"],
  [gazeLabel, "Iris offset: no valid measurement"],
  [quadrantLabel, "Looking toward: no valid measurement"],
  [gazeStateLabel, "Gaze state: no valid measurement"],
  [fixationStatsLabel, "Fixations in the last 10 s: none yet"],
  [headPoseLabel, "Head pose: no valid measurement"],
  [blinkLabel, "Blinks: 0"],
  [baselineLabel, "Personal blink threshold: not learned yet"],
  [featureLabel, "Feature records: none yet (about one per second)"],
] as const) {
  element.textContent = initial;
}

// Labels light, measurements bold. Done here rather than in the
// message functions because those are tested constants and the tests
// assert whole sentences; this is a rendering concern and belongs at
// the rendering edge.
//
// Splitting on the FIRST colon works because every readout is written
// as "Label: value". A line with no colon is left alone rather than
// guessed at.
function writeReadout(element: HTMLElement, text: string): void {
  const at = text.indexOf(": ");
  if (at === -1) {
    element.textContent = text;
    return;
  }
  const label = document.createElement("span");
  label.textContent = text.slice(0, at + 2);
  const value = document.createElement("span");
  value.className = "value";
  value.textContent = text.slice(at + 2);
  element.replaceChildren(label, value);
}

navBar.append(title, linkedInLink);
statusBanner.append(bannerIdle, status, modelStatus, alertBanner);

// The page used to stop dead at the last box, with the window's edge
// doing the work a closing line should do. The 16 pixels above this
// come from #content's own bottom padding, so the gap before the rule
// is the same 16 the boxes use between themselves.
const pageFooter = document.createElement("footer");
pageFooter.id = "page-footer";
pageFooter.className = "page-column";
const footerLine = document.createElement("p");
footerLine.textContent = "Eivinas Norusaitis, 2026";
pageFooter.append(footerLine);

// The idle line hides itself whenever a real message arrives, and the
// strip turns orange only for an alert. Watched rather than computed,
// because status text is written from a dozen places that do not call
// render(), which is exactly how the old collapsing banner went stale.
function refreshBanner(): void {
  const speaking =
    status.textContent !== "" ||
    modelStatus.textContent !== "" ||
    !alertBanner.hidden;
  // Written only when it would actually change, and that guard is load
  // bearing rather than tidiness. This function sets `hidden`, and the
  // observer below watches `hidden` across the whole strip, so an
  // unconditional write re-triggers the observer forever. The page then
  // never finishes loading at all: every browser sat on `page.goto`
  // until it timed out, on a clean CI machine as well as a busy laptop,
  // and the overnight corpus run silently produced nothing for an hour.
  if (bannerIdle.hidden !== speaking) {
    bannerIdle.hidden = speaking;
  }
  statusBanner.classList.toggle("alerting", !alertBanner.hidden);
}
new MutationObserver(refreshBanner).observe(statusBanner, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["hidden"],
});
refreshBanner();

app.append(
  demoNotice,
  navBar,
  bannerColumn,
  contentBox,
  pageFooter,
  calibrationOverlay,
  heatmapOverlay,
);
render();

// The display loop drives the camera. A clip is driven by its own
// decoded frames instead, so this returns early in file mode rather
// than sampling an interpolated currentTime sixty times a second.
startFrameLoop((wallClockMs) => {
  if (frameSource === "file") return;
  const clockStep = acceptFrame(frameClock, wallClockMs);
  frameClock = clockStep.state;
  if (!clockStep.accepted) return;
  processFrame(wallClockMs, wallClockMs);
});
