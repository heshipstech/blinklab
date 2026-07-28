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
import { keepRecent, measureFps } from "./core/fps";
import { frameTransform } from "./core/transform";
import { displaySize } from "./core/videoLayout";
import { listMediaDevices, startCamera, stopCamera } from "./io/camera";
import { startFrameLoop } from "./io/frameLoop";
import { drawVideoFrame } from "./io/videoCanvas";

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

const status = document.createElement("p");

let state: CameraState = { kind: "idle" };

function render(): void {
  status.textContent = cameraStateMessage(state);
  canvas.hidden = state.kind !== "running";
  mirrorLabel.hidden = state.kind !== "running";
  resolutionLabel.hidden = state.kind !== "running";
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

startButton.addEventListener("click", () => {
  void beginCamera();
});

picker.addEventListener("change", () => {
  void beginCamera(picker.value);
});

const fpsLabel = document.createElement("p");

let frameTimestampsMs: number[] = [];

startFrameLoop((nowMs) => {
  frameTimestampsMs.push(nowMs);
  frameTimestampsMs = keepRecent(frameTimestampsMs, nowMs, 2000);
  const fps = measureFps(frameTimestampsMs);
  fpsLabel.textContent =
    fps === null
      ? "Frames per second: measuring..."
      : `Frames per second: ${String(Math.round(fps))}`;

  if (state.kind === "running" && canvasContext !== null) {
    drawVideoFrame(
      canvasContext,
      video,
      frameTransform(mirrored, canvas.width),
    );
  }
});

app.append(
  title,
  startButton,
  picker,
  canvas,
  mirrorLabel,
  resolutionLabel,
  status,
  fpsLabel,
);
render();
