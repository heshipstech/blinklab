import {
  cameraStateMessage,
  classifyCameraError,
  type CameraState,
} from "./core/cameraState";
import { keepRecent, measureFps } from "./core/fps";
import { displaySize } from "./core/videoLayout";
import { startCamera } from "./io/camera";
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

// The video element is only a source now. It never joins the page,
// the canvas below shows what we draw from it each frame.
const video = document.createElement("video");
video.playsInline = true;
video.muted = true;

const canvas = document.createElement("canvas");
let canvasContext: CanvasRenderingContext2D | null = null;

const status = document.createElement("p");

let state: CameraState = { kind: "idle" };

function render(): void {
  status.textContent = cameraStateMessage(state);
  canvas.hidden = state.kind !== "running";
  startButton.hidden = state.kind === "running" || state.kind === "requesting";
}

function setState(next: CameraState): void {
  state = next;
  render();
}

startButton.addEventListener("click", () => {
  setState({ kind: "requesting" });
  startCamera(video).then(
    (frame) => {
      const display = displaySize(frame.widthPx, frame.heightPx, 640);
      if (display !== null) {
        canvas.width = display.width;
        canvas.height = display.height;
      }
      canvasContext = canvas.getContext("2d");
      setState({ kind: "running" });
    },
    (error: unknown) => {
      const name = error instanceof Error ? error.name : String(error);
      setState(classifyCameraError(name));
    },
  );
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
    drawVideoFrame(canvasContext, video);
  }
});

app.append(title, startButton, canvas, status, fpsLabel);
render();
