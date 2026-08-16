// The stylesheet is a real file now rather than a string appended to
// the head at runtime. Vite emits it as its own asset, so it is cached,
// formatted and highlighted like the code it styles.
import "./styles.css";

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
import { apertureMm, aperturePx, irisWidthPx } from "./core/aperture";
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
  processingRateMessage,
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
import {
  EXPORT_NOTHING_RECORDED,
  EXPORT_NO_BLINKS,
  EXPORT_WAITING_FOR_KSS,
  exportedMessage,
} from "./core/exportStatus";
import {
  IRIS_SAMPLE_CAP,
  deviceMetadataRows,
  sessionMetadataRows,
  type DeviceInfo,
  type MeasurementFrame,
  type SessionMarker,
} from "./core/sessionMetadata";
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
  BLINK_TABLE_HEADERS,
  appendEvent,
  blinkTableRow,
  eventsForDisplay,
  serialiseBlinkEvents,
  type BlinkEvent,
} from "./core/blinkLog";
import { analyzeClosing, shapeWindowStartMs } from "./core/blinkShape";
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
  eraseStoredData,
  loadCalibrationProfile,
  probeStoredData,
  saveCalibrationProfile,
  saveCalibrationSamples,
} from "./io/calibrationStore";
import {
  STORED_ITEMS,
  eraseButtonLabel,
  eraseOutcomeMessage,
  hasSomethingToErase,
  storedSummary,
} from "./core/storedData";
import { listMediaDevices, startCamera, stopCamera } from "./io/camera";
import { readDeviceInfo } from "./io/deviceInfo";
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

// SVG needs its own namespace or the elements render as unknown tags.
const SVG_NS = "http://www.w3.org/2000/svg";

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
demoNotice.style.margin = "0";

// The whole notice, never a shortened one. A phone getting a trimmed
// version would republish a claim this page spent two weeks correcting;
// see ADR-0004. It is taller on a narrow screen and that is the cost.
const noticeIcon = document.createElementNS(SVG_NS, "svg");
noticeIcon.setAttribute("width", "14");
noticeIcon.setAttribute("height", "14");
noticeIcon.setAttribute("viewBox", "0 0 24 24");
noticeIcon.setAttribute("fill", "none");
noticeIcon.setAttribute("aria-hidden", "true");
const noticeRing = document.createElementNS(SVG_NS, "circle");
noticeRing.setAttribute("cx", "12");
noticeRing.setAttribute("cy", "12");
noticeRing.setAttribute("r", "10");
noticeRing.setAttribute("stroke", "#f97316");
noticeRing.setAttribute("stroke-width", "2");
const noticeBang = document.createElementNS(SVG_NS, "path");
noticeBang.setAttribute("d", "M12 7v6m0 3.5v.5");
noticeBang.setAttribute("stroke", "#f97316");
noticeBang.setAttribute("stroke-width", "2");
noticeBang.setAttribute("stroke-linecap", "round");
noticeIcon.append(noticeRing, noticeBang);

const noticeInner = document.createElement("div");
noticeInner.className = "page-column notice-inner";
noticeInner.append(noticeIcon, demoNotice);

const noticeBar = document.createElement("div");
noticeBar.id = "demo-notice";
noticeBar.append(noticeInner);

// The top bar. The mark, the name, and two outbound links. It
// deliberately does not stick: this page gets screenshotted and filmed,
// and fixed chrome eats vertical space on a laptop for no measurement
// benefit.
const navBar = document.createElement("div");
navBar.className = "page-column nav";

function iconLink(
  href: string,
  label: string,
  path: string,
): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.className = "icon-link";
  link.setAttribute("aria-label", label);
  if (href.startsWith("http")) {
    link.target = "_blank";
    // noopener stops the opened page reaching back through
    // window.opener, which matters more than usual here because this
    // page's whole claim is that nothing leaves the device.
    link.rel = "noopener noreferrer";
  }
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS(SVG_NS, "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  link.append(svg);
  return link;
}

const brandMark = document.createElement("span");
brandMark.className = "brand-mark";
const eyeSvg = document.createElementNS(SVG_NS, "svg");
eyeSvg.setAttribute("viewBox", "0 0 24 24");
eyeSvg.setAttribute("width", "15");
eyeSvg.setAttribute("height", "15");
eyeSvg.setAttribute("fill", "none");
eyeSvg.setAttribute("aria-hidden", "true");
const eyeOutline = document.createElementNS(SVG_NS, "path");
eyeOutline.setAttribute(
  "d",
  "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z",
);
eyeOutline.setAttribute("stroke", "#ffffff");
eyeOutline.setAttribute("stroke-width", "1.8");
const eyePupil = document.createElementNS(SVG_NS, "circle");
eyePupil.setAttribute("cx", "12");
eyePupil.setAttribute("cy", "12");
eyePupil.setAttribute("r", "2.6");
eyePupil.setAttribute("fill", "#ffffff");
eyeSvg.append(eyeOutline, eyePupil);
brandMark.append(eyeSvg);

const brand = document.createElement("div");
brand.className = "brand";
brand.append(brandMark, title);

const navLinks = document.createElement("div");
navLinks.className = "nav-links";
navLinks.append(
  iconLink(
    "https://www.linkedin.com/in/eivinasnorusaitis/",
    "LinkedIn profile",
    "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z",
  ),
  iconLink(
    "mailto:e.norusaitis@gmail.com",
    "Email",
    "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  ),
);

navBar.append(brand, navLinks);

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

// The way back from a failed model download. Visible only in the
// modelFailed state, and named exactly as the status message names
// it, so the sentence and the button read as one instruction.
const retryModelButton = document.createElement("button");
retryModelButton.textContent = "Retry loading the model";
retryModelButton.setAttribute("data-testid", "retry-model");
retryModelButton.hidden = true;

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
// The conditions of the measurement, recorded beside it. A camera
// session used to export no rate and no word about the camera.
let deviceInfo: DeviceInfo | null = null;
let irisWidthSamples: number[] = [];
// The frame the model read, recorded so the iris width above has a
// stated unit. The canvas is a display size and cannot stand in for it.
let measurementFrame: MeasurementFrame | null = null;
let sessionMarkers: SessionMarker[] = [];
let visibilityChanges = 0;
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
// Set when the display loop dies (remediation B3). The loop starts
// once per page life, so after a crash there is nothing behind the
// camera path until a reload: beginCamera refuses while this is set,
// re-showing the crash instead of a session that could only freeze.
let frameLoopCrashReason: string | null = null;
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
  // Entering the running state recomputes the heatmap button from
  // the stored profile. The force-off below is only half a rule:
  // without this half, a returning visitor with a saved calibration
  // had the button disabled at page load and NOTHING re-enabled it,
  // because the only other refresh sits behind a fresh solve. The
  // heatmap and the replay behind it were unreachable on every visit
  // after the first. Remediation B5.
  if (running) {
    refreshHeatmapButton();
  }
  if (!running) {
    for (const button of [heatmapButton, replayButton]) {
      button.disabled = true;
    }
    // measurementFailed keeps the exports. Its message promises the
    // recorded data can still be exported, and buttons that
    // contradict the message are worse than no message. The count
    // rule from the last running frame still holds, so a session
    // that recorded nothing stays disabled. Remediation B3.
    if (state.kind !== "measurementFailed") {
      exportButton.disabled = true;
      exportBlinksButton.disabled = true;
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
  retryModelButton.hidden = state.kind !== "modelFailed";
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
  exportStatus.textContent = "";
  sessionStartedAtEpochMs = null;
  kssBefore = null;
  kssAfter = null;
  kssBeforeAsked = false;
  kssAfterAsked = false;
  kssPanel.hidden = true;
  refreshKssLine();
  writeReadout(featureLabel, "");
  writeReadout(scoreLabel, "");
  panelSummaryLabel.textContent = "";
  panelList.replaceChildren();
  // Review found this missing: without it the previous session's
  // last blink duration still charged the new session's score,
  // possibly a different person's blink entirely.
  blinkState = initialBlinkState;
  blinkTableBody.replaceChildren();
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
  deviceInfo = null;
  irisWidthSamples = [];
  measurementFrame = null;
  sessionMarkers = [];
  visibilityChanges = 0;
  refreshMarkButton();
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
  // A dead display loop cannot run a camera session. Refuse with the
  // original reason rather than entering a "running" state whose
  // readouts would freeze on their first values. The refusal comes
  // AFTER the supersede lines above on purpose: review found the
  // early version returning before them, which left a live clip run
  // half-stopped, still seeking while its measurements were frozen.
  // Clips keep working: both clip drivers are their own loops.
  if (frameLoopCrashReason !== null) {
    setState({ kind: "measurementFailed", reason: frameLoopCrashReason });
    return;
  }
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
    // AFTER resetSession, which clears it, and after the stream is
    // live, because getSettings() on a track that has not finished
    // negotiating returns an empty object. Both orderings were wrong
    // once: reading before the reset was silently wiped, and the end
    // to end test caught it by finding the whole device block missing
    // from a camera export.
    deviceInfo = readDeviceInfo(video);
    askKss("Before you begin: how sleepy do you feel?", (rating) => {
      kssBefore = rating;
      kssBeforeAsked = true;
    });
    setState({ kind: "running" });
    // Fired, not awaited: the camera preview is honest on its own
    // while the model downloads. But the failure is no longer
    // fire-and-forget with it. Before B2 this call swallowed a failed
    // download and the session ran forever looking healthy, readouts
    // saying "measuring..." for a measurement that could never come.
    void ensureLandmarker().then((ready) => {
      if (ready || runToken !== sourceRunToken) return;
      // The camera stops with the session. Leaving it capturing
      // behind a failure screen that says "nothing can be measured"
      // would keep the recording light on while the page hides every
      // sign of the stream; review called that the dishonest shape.
      // Retry re-requests the camera, which a granted permission
      // makes near-instant.
      stopCamera(video);
      setState({ kind: "modelFailed" });
    });
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
    const modelReady = await ensureLandmarker();
    if (runToken !== sourceRunToken) return;
    // Refused BEFORE the first seek. The alternative was measured on
    // this exact scenario during B1: the stepper walked every frame
    // for nothing and the summary could only guess at why the count
    // was zero. Here the cause is still known by name.
    if (!modelReady) {
      setState({ kind: "modelFailed" });
      return;
    }
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
      // clause false, while the export buttons sat disabled. Since
      // B2, a missing model is refused by name before the first
      // seek, so a zero here has no known cause and the message
      // claims none. Defense in depth: kept even though no staged
      // test can currently reach it.
      if (framesMeasured === 0) {
        setState({
          kind: "clipFailed",
          reason:
            "This clip was read frame by frame, but not one frame was measured, so there is no result to report. Reload the page and try the clip again.",
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
    clipLoop = startVideoFrameLoop(
      video,
      (mediaTimeSeconds) => {
        const nowMs = frameTimestampMs("file", 0, mediaTimeSeconds);
        const clockStep = acceptFrame(frameClock, nowMs);
        frameClock = clockStep.state;
        if (!clockStep.accepted) return;
        processFrame(nowMs, performance.now());
      },
      (error) => {
        // This loop belongs to one clip, so no page-wide flag: the
        // next source builds a fresh loop. The session still ends
        // visibly, with the data kept. The token bump keeps it that
        // way: without it, pausing here rejected beginVideoFile's
        // pending play() with an AbortError, whose catch then wrote
        // that browser prose over this state as a clip diagnosis.
        console.error("the clip measurement loop stopped:", error);
        sourceRunToken += 1;
        setState({
          kind: "measurementFailed",
          reason: error instanceof Error ? error.message : String(error),
        });
        try {
          video.pause();
        } catch (pauseError: unknown) {
          console.error("the clip could not be paused:", pauseError);
        }
      },
    );

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
    // A throw AFTER frames were measured is a mid-run measurement
    // crash, not a broken file: the stepped driver has no loop
    // wrapper, so its throws land here. clipFailed would frame the
    // internal error as a file problem and, worse, force-disable the
    // exports, silently revoking minutes of recorded data that
    // measurementFailed keeps offered. Remediation B3, from review.
    if (framesMeasured > 0) {
      console.error("the clip measurement stopped mid-run:", error);
      setState({ kind: "measurementFailed", reason });
      return;
    }
    setState({ kind: "clipFailed", reason });
  }
}

let landmarker: FaceLandmarker | null = null;
let landmarkerLoadingPromise: Promise<boolean> | null = null;
let lastFacePresent: boolean | null = null;

// Resolves true when the model is ready, false when the download
// failed. Concurrent callers share one attempt and one answer. After
// a failure the promise is cleared, so the next call is a genuine
// retry rather than a cached no. The old version swallowed the
// failure into the console and resolved void, and every caller
// carried on as if measurement were possible; remediation B2 gives
// the failure a state instead (modelFailed, with a retry button).
async function ensureLandmarker(): Promise<boolean> {
  if (landmarker !== null) {
    return true;
  }
  landmarkerLoadingPromise ??= loadLandmarker()
    .then((loaded) => {
      landmarker = loaded;
      return true;
    })
    .catch((error: unknown) => {
      console.error("face landmarker failed to load:", error);
      return false;
    })
    .finally(() => {
      landmarkerLoadingPromise = null;
    });
  return landmarkerLoadingPromise;
}

startButton.addEventListener("click", () => {
  void beginCamera();
});

retryModelButton.addEventListener("click", () => {
  void retryModel();
});

async function retryModel(): Promise<void> {
  if (state.kind !== "modelFailed") return;
  // Read, not bumped: a retry is another attempt at the same
  // session, but a genuinely new source starting mid-download must
  // still win over this continuation.
  const runToken = sourceRunToken;
  retryModelButton.disabled = true;
  status.textContent = "Loading the measuring model again...";
  const ready = await ensureLandmarker();
  retryModelButton.disabled = false;
  if (runToken !== sourceRunToken) return;
  if (!ready) {
    // The same state re-entered on purpose: the message comes back,
    // and the console carries the loader's underlying error.
    setState({ kind: "modelFailed" });
    return;
  }
  // A camera session goes back through the front door. beginCamera
  // re-requests the stream, which a granted permission makes fast,
  // and a camera that has meanwhile been unplugged gets its own
  // honest state from the same path instead of a session resumed
  // over a dead stream. The session restarts from zero, baseline
  // and all, because nothing was measured under the failed model.
  if (frameSource === "camera") {
    void beginCamera();
    return;
  }
  // A clip run never started under a missing model, so there is
  // nothing to resume. Idle's own message talks about the camera,
  // so the next step for a clip is written over it.
  setState({ kind: "idle" });
  status.textContent =
    "The model is loaded now. Pick your clip again to measure it.";
}

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

// Remediation E3. Two keys were written to this browser from the first
// calibration onwards and nothing on the page said so, let alone
// offered to undo it. The list is rendered from core/storedData.ts
// rather than typed here, so adding a third key cannot leave the
// interface quietly describing two.
const storedSummaryLabel = document.createElement("p");
const storedList = document.createElement("ul");
storedList.className = "stored-list";
for (const item of STORED_ITEMS) {
  const entry = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = item.what;
  entry.append(name, document.createTextNode(`, ${item.why} (${item.key})`));
  storedList.append(entry);
}
const eraseButton = document.createElement("button");
eraseButton.dataset.testid = "erase-stored-data";
const eraseStatus = document.createElement("p");
eraseStatus.dataset.testid = "erase-status";
eraseStatus.hidden = true;

// Erasing costs the visitor the nine dot calibration, so one stray
// click should not do it. The confirm step is a second click on the
// same button rather than a native dialog: it stays inside the page's
// own vocabulary, and it can be driven by a test, which a native
// confirm cannot.
let eraseArmed = false;

function refreshStoredBox(): void {
  const probe = probeStoredData();
  storedSummaryLabel.textContent = storedSummary(probe);
  const somethingToErase = hasSomethingToErase(probe);
  eraseButton.disabled = !somethingToErase;
  if (!somethingToErase) {
    eraseArmed = false;
  }
  eraseButton.textContent = eraseButtonLabel(probe, eraseArmed);
}

eraseButton.addEventListener("click", () => {
  if (!eraseArmed) {
    eraseArmed = true;
    refreshStoredBox();
    return;
  }
  const after = eraseStoredData();
  eraseArmed = false;
  eraseStatus.textContent = eraseOutcomeMessage(after);
  eraseStatus.hidden = false;
  // The profile was also held in memory, and leaving it there would
  // keep the heatmap reachable from data the visitor just asked this
  // page to forget. Remediation B5 was the same bug facing the other
  // way: two rules writing one property with no meeting point.
  calibrationProfile = null;
  calibrateButton.textContent = "Calibrate gaze";
  refreshHeatmapButton();
  refreshStoredBox();
});

refreshStoredBox();

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
let kssBeforeAsked = false;
let kssAfter: KssRating | null = null;
let kssAfterAsked = false;
// A modal, not a panel inside the Session card.
//
// As a panel it sat low in a card that can run past the fold, and the
// export waits on its answer, so a person clicking Export and seeing
// nothing move reported the button as broken when it was merely
// waiting. A dialog over a dimmed page cannot be scrolled past.
const kssPrompt = document.createElement("p");
kssPrompt.className = "kss-prompt";
const kssButtons = document.createElement("div");
kssButtons.className = "kss-grid";

const kssDialog = document.createElement("div");
kssDialog.className = "kss-dialog";
kssDialog.setAttribute("role", "dialog");
kssDialog.setAttribute("aria-modal", "true");
kssDialog.setAttribute("aria-labelledby", "kss-prompt");
kssPrompt.id = "kss-prompt";
kssDialog.append(kssPrompt, kssButtons);

const kssPanel = document.createElement("div");
kssPanel.id = "kss-backdrop";
kssPanel.hidden = true;
kssPanel.append(kssDialog);

// Deliberately NOT closable by clicking the backdrop or pressing
// Escape. Every way out of this dialog records an answer, and Skip is
// one of them: a dismissal that recorded nothing would leave a session
// whose file cannot say whether the question was declined or never
// asked.

// The answer stays visible after the dialog closes. As an inline panel
// it simply stayed on screen as a disabled button, and being able to
// see what you actually answered is part of trusting the file it goes
// into: otherwise you are left with a number in a CSV and no memory of
// the question. A modal cannot do that by staying open, so the record
// moves into the Session card.
const kssAnswerLabel = document.createElement("p");

function describeRating(rating: KssRating | null, asked: boolean): string {
  if (!asked) {
    return "not asked yet";
  }
  const step = KSS_SCALE.find((s) => s.rating === rating);
  return step === undefined
    ? "skipped"
    : `${String(step.rating)} ${step.label}`;
}

function refreshKssLine(): void {
  if (!kssBeforeAsked && !kssAfterAsked) {
    kssAnswerLabel.textContent = "";
    return;
  }
  writeReadout(
    kssAnswerLabel,
    `Sleepiness: before ${describeRating(kssBefore, kssBeforeAsked)}, after ${describeRating(kssAfter, kssAfterAsked)}`,
  );
}

function askKss(
  question: string,
  onAnswer: (r: KssRating | null) => void,
): void {
  // Split like every other readout: the lead-in stays light and the
  // question itself is bold, which is what the design shows.
  writeReadout(kssPrompt, question);

  const choose = (rating: KssRating | null): void => {
    // The dialog closes on every path out of it. Left open it blocks
    // the page it is asking about, which is the difference between a
    // modal and the panel this used to be.
    kssPanel.hidden = true;
    onAnswer(rating);
    refreshKssLine();
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
  // Focus moves into the dialog so a keyboard reaches the ratings
  // without tabbing the whole page first, and so a screen reader
  // announces the question rather than leaving the user where they
  // were.
  const first = kssButtons.querySelector("button");
  if (first !== null) {
    first.focus();
  }
}

function exportSession(): void {
  const csv = serializeRecords(featureRecords, [
    ...sourceMetadataRows(frameSource, loadedClipName),
    ...coverageMetadataRows(
      measurementMode,
      framesMeasured,
      loadedClipDurationSeconds,
    ),
    ...deviceMetadataRows(deviceInfo),
    ...sessionMetadataRows(
      featureRecords,
      irisWidthSamples,
      sessionMarkers,
      visibilityChanges,
      measurementFrame,
    ),
    ...kssMetadataRows(kssBefore, kssAfter),
  ]);
  if (csv === null) {
    // A bare `return` here produced no file, no error and no message.
    exportStatus.textContent = EXPORT_NOTHING_RECORDED;
    return;
  }
  // Colons are not safe in filenames on every system, so the ISO
  // stamp is punctuated with dashes: sorts by name, sorts by time.
  const stamp = new Date(sessionStartedAtEpochMs ?? Date.now())
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  exportStatus.textContent = exportedMessage(
    downloadTextFile(`blinklab-session-${stamp}.csv`, csv, "text/csv"),
  );
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
  if (csv === null) {
    exportStatus.textContent = EXPORT_NO_BLINKS;
    return;
  }
  const stamp = new Date(sessionStartedAtEpochMs ?? Date.now())
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  exportStatus.textContent = exportedMessage(
    downloadTextFile(`blinklab-blinks-${stamp}.csv`, csv, "text/csv"),
  );
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
    // The click that looks like nothing. It opens the question below
    // and returns, and the file only arrives once the question is
    // answered, so the button now says so instead of leaving a person
    // clicking it again.
    exportStatus.textContent = EXPORT_WAITING_FOR_KSS;
    askKss("How sleepy do you feel now?", (rating) => {
      kssAfter = rating;
      kssAfterAsked = true;
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
// A table rather than a prose list. Units live in the header instead of
// on every cell, the columns line up so an odd row is visible rather
// than merely readable, and the scroll area is sized to about five rows
// with the header staying put above them.
const blinkTableBody = document.createElement("tbody");

const blinkTable = document.createElement("table");
blinkTable.className = "blink-table";
blinkTable.setAttribute("aria-label", "Blink events");
const blinkTableHead = document.createElement("thead");
const blinkHeadRow = document.createElement("tr");
for (const heading of BLINK_TABLE_HEADERS) {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = heading;
  blinkHeadRow.append(cell);
}
blinkTableHead.append(blinkHeadRow);
blinkTable.append(blinkTableHead, blinkTableBody);

const blinkLogList = document.createElement("div");
blinkLogList.className = "blink-table-scroll";
blinkLogList.append(blinkTable);
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
    state.kind !== "running" ? "" : processingRateMessage(fps, frameSource),
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
      // The frame the model just read. Recorded here rather than beside
      // the iris sampling, because it is a property of the SOURCE and is
      // just as true of a frame with no face in it. Behind the face
      // branch it stayed "unknown" for any session that never found one,
      // which is exactly the session whose conditions you most want.
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        measurementFrame = {
          widthPx: video.videoWidth,
          heightPx: video.videoHeight,
        };
      }
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
        // Dev only. This line shipped to the public site from PR #33
        // until 2026-08-14, logging on every face-presence change
        // inside the frame loop. Vite strips the branch from the
        // production bundle, the way it already strips createRecorder().
        // The disable is needed because no-console cannot see the DEV
        // guard; it is the one exemption in src/, and it is deliberate.
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log("face detected:", present);
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

          // The measurement's own resolution: how many pixels the iris
          // spans is what every millimetre on this page is divided by.
          // Sampled per frame and summarised as a median at export.
          // Measured against the VIDEO, not the canvas. detectForVideo
          // is handed the video element, so the landmarks describe that
          // frame; the canvas is capped at 640 wide for display and
          // would halve this number for no reason but the layout.
          if (
            irisWidthSamples.length < IRIS_SAMPLE_CAP &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            const irisPx = irisWidthPx(
              face,
              RIGHT_IRIS_RING_INDICES,
              video.videoWidth,
              video.videoHeight,
            );
            if (irisPx !== null) {
              irisWidthSamples.push(irisPx);
            }
          }

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
          // A profile that could not be stored still calibrates THIS
          // session: the in-memory profile is already active. The
          // button label is the one persistent surface next to the
          // feature, so the storage failure is written there rather
          // than lost to the console. Remediation B3.
          let profileStored = true;
          if (solved !== null) {
            calibrationProfile = solved;
            profileStored = saveCalibrationProfile(solved);
          }
          captureState = null;
          calibrationOverlay.hidden = true;
          calibrateButton.textContent =
            solved === null
              ? "Recalibrate gaze (solver refused the samples, try again)"
              : profileStored
                ? "Recalibrate gaze"
                : "Recalibrate gaze (calibrated for now, but could not be stored, so it will not survive a reload)";
          refreshHeatmapButton();
          // A calibration is the only thing that puts anything in
          // storage, so this is the one moment the stored-data box can
          // go from empty to occupied while the page is open.
          refreshStoredBox();
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
      // Captured BEFORE the step: after it, the reducer's memory of
      // "the previous blink's end" is already this blink's end.
      const previousBlinkEndMs = blinkState.lastBlinkEndedAtMs;
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
        // little lead in, from the rolling aperture history, clipped
        // at the previous blink's end so the window cannot reach back
        // over it. Unclipped, a quick second blink was published
        // with its predecessor's closing velocity. Remediation B4.
        const closureStartMs = shapeWindowStartMs(
          nowMs,
          blinkState.lastBlinkDurationMs ?? 0,
          previousBlinkEndMs,
        );
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
        blinkTableBody.replaceChildren(
          // The table shows a tail, newest first. The record above it
          // keeps everything.
          ...[...eventsForDisplay(blinkEvents)].reverse().map((event) => {
            const row = document.createElement("tr");
            const { cells, faint } = blinkTableRow(event, sessionStartMs ?? 0);
            if (faint) {
              row.className = "faint";
            }
            row.append(
              ...cells.map((text) => {
                const cell = document.createElement("td");
                cell.textContent = text;
                return cell;
              }),
            );
            return row;
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
        // The marker rides the same gate as the exports: there is
        // nothing to mark until at least one record exists to mark
        // against.
        refreshMarkButton();
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
  // A stable handle per card, derived from its own heading, so the
  // stylesheet can put them in reading order on a phone without a
  // second list of names to keep in step with this one.
  element.id = `box-${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
// Every export outcome says what happened, including the successful
// one. Two of the three used to be silent, which from the outside is
// indistinguishable from a broken button.
const exportStatus = document.createElement("p");
exportStatus.dataset.testid = "export-status";

const markButton = document.createElement("button");
markButton.textContent = "Mark this moment";
markButton.setAttribute("data-testid", "mark-moment");
markButton.disabled = true;
const markLabel = document.createElement("p");

// Why a marker exists at all. A validation protocol asks someone to
// blink deliberately ten times, so that ten is known ground truth.
// Finding those ten in the export means hunting for a burst of ten
// detections, which fails exactly when the instrument MISSED them,
// which is the case worth measuring. Using the instrument's own output
// to locate the event that tests the instrument is circular. A marker
// breaks the circle: the truth becomes "ten blinks between marker 1
// and marker 2", whatever the instrument thought happened.
function refreshMarkButton(): void {
  markButton.disabled = sessionStartedAtEpochMs === null;
  markLabel.textContent =
    sessionMarkers.length === 0
      ? ""
      : `Marks: ${sessionMarkers
          .map(
            (marker) =>
              `${marker.index} at ${(marker.atMs / 1000).toFixed(1)} s`,
          )
          .join(", ")}`;
}

markButton.addEventListener("click", () => {
  // Stamped on the same clock the records use, so a marker and a
  // measurement can be compared without a conversion nobody checked.
  const atMs = lastRecordAtMs ?? 0;
  sessionMarkers = [
    ...sessionMarkers,
    { atMs, index: sessionMarkers.length + 1 },
  ];
  refreshMarkButton();
});

// A hidden tab stops the animation frame callback, so the record has a
// gap that looks like a person who stopped blinking. Counting the
// switches lets the analysis tell one from the other.
document.addEventListener("visibilitychange", () => {
  visibilityChanges += 1;
});

const exportRow = document.createElement("div");
exportRow.className = "button-row";
exportRow.append(
  // Mark first: it is used DURING a session while the two exports end
  // one, so the order is the order a person needs them in.
  markButton,
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
  retryModelButton,
  clipLabel,
  stepLabel,
  stopClipButton,
  picker,
  canvas,
  cameraLine,
);

const alertnessBox = box("Alertness", scoreLabel, panelSummaryLabel, panelList);
scoreLabel.className = "headline";

const sessionBox = box(
  "Session",
  featureLabel,
  exportRow,
  exportStatus,
  markLabel,
  kssAnswerLabel,
);

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
// them go quiet. Next to "processing rate" they would explain
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
// being captured. Processing rate and inference time are not measurements
// of the eyes, but they ARE measurements of the signal on this strip,
// so they belong beside it rather than in a box of their own.
const liveSignalsBox = box("Live signals", graphStrip, signalsFooter);

// Source sits in the wider column because it holds the video, which is
// sized to 640 px. An even split of a 1280 column leaves about 630 per
// side once the gap is taken, which would shrink the picture.

liveSignalsBox.id = "live-signals";

// Last, deliberately. It is read between sessions rather than during
// one, and it is the only box whose button destroys something, so it
// sits away from the controls a person reaches for while measuring.
const storedDataBox = box(
  "Stored on this device",
  storedSummaryLabel,
  storedList,
  eraseButton,
  eraseStatus,
);

// Two columns on a wide window, one on a phone.
//
// The columns are real elements so each flows independently, which is
// what lets Source be tall without stretching Gaze beside it. A grid
// with placed items would have forced them into shared rows.
//
// Below the breakpoint the wrappers become `display: contents` and every
// card is a direct grid item, so the stylesheet can `order` them into
// reading order for a phone: the score, then what starts a session,
// then the camera, then what it measured, then the instrument's own
// health, then storage. That order is deliberately NOT the desktop
// column order, and doing it with `order` rather than a second DOM tree
// means there is one list of cards, not two that can disagree.
const columnA = document.createElement("div");
columnA.className = "col";
columnA.append(alertnessBox, sourceBox, liveSignalsBox);

const columnB = document.createElement("div");
columnB.className = "col";
columnB.append(sessionBox, gazeBox, eyesBox, blinksBox);

const grid = document.createElement("div");
grid.className = "grid";
grid.append(columnA, columnB, storedDataBox);

contentBox.append(grid);

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
  // Through writeReadout, not textContent. Setting it directly skipped
  // the label/value split, so every readout rendered as one flat run in
  // the idle state and only snapped into two columns once a session
  // started. The starting state is the one a visitor sees first.
  writeReadout(element, initial);
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
  label.textContent = text.slice(0, at);
  // The colon is hidden, not deleted. The design puts the label left
  // and the value hard right on one baseline, where a colon floating in
  // the gap reads as a typo. But removing it from the DOM broke the
  // sentence: three end to end tests stopped finding "Processing rate:
  // 136" because the paragraph now read "Processing rate136", and a
  // screen reader would have heard the same run-on. Visually hidden and
  // taken out of flow, so it is there for anything that reads the text
  // and gone for anything that looks at it.
  const separator = document.createElement("span");
  separator.className = "sep";
  separator.textContent = ": ";
  const value = document.createElement("span");
  value.className = "value";
  value.textContent = text.slice(at + 2);
  element.replaceChildren(label, separator, value);
}

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
  noticeBar,
  navBar,
  bannerColumn,
  contentBox,
  pageFooter,
  calibrationOverlay,
  heatmapOverlay,
  kssPanel,
);
render();

// The display loop drives the camera. A clip is driven by its own
// decoded frames instead, so this returns early in file mode rather
// than sampling an interpolated currentTime sixty times a second.
startFrameLoop(
  (wallClockMs) => {
    if (frameSource === "file") return;
    const clockStep = acceptFrame(frameClock, wallClockMs);
    frameClock = clockStep.state;
    if (!clockStep.accepted) return;
    processFrame(wallClockMs, wallClockMs);
  },
  (error) => {
    // The loop is dead for the life of the page, and the flag is what
    // keeps that honest: beginCamera refuses while it is set, because
    // a "running" session with no loop behind it is the frozen page
    // this state exists to replace. Records stop appending because
    // nothing appends them; what was recorded stays exportable.
    //
    // The token bump makes every in-flight continuation stale:
    // review walked a pending startCamera resolving AFTER the crash
    // and writing "running" over this state, camera light on, page
    // frozen. The state is written FIRST because it is the one duty
    // that may not be skipped; stopping the camera is best effort.
    console.error("the measurement loop stopped:", error);
    sourceRunToken += 1;
    frameLoopCrashReason =
      error instanceof Error ? error.message : String(error);
    setState({ kind: "measurementFailed", reason: frameLoopCrashReason });
    try {
      stopCamera(video);
    } catch (stopError: unknown) {
      console.error("the camera could not be stopped:", stopError);
    }
  },
);
