import {
  cameraStateMessage,
  classifyCameraError,
  type CameraState,
} from "./core/cameraState";
import { displaySize } from "./core/videoLayout";
import { startCamera } from "./io/camera";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error('index.html must contain an element with id "app"');
}

const title = document.createElement("h1");
title.textContent = "blinklab";

const startButton = document.createElement("button");
startButton.textContent = "Start camera";

const video = document.createElement("video");
video.playsInline = true;
video.muted = true;

const status = document.createElement("p");

let state: CameraState = { kind: "idle" };

function render(): void {
  status.textContent = cameraStateMessage(state);
  video.hidden = state.kind !== "running";
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
        video.width = display.width;
        video.height = display.height;
      }
      setState({ kind: "running" });
    },
    (error: unknown) => {
      const name = error instanceof Error ? error.name : String(error);
      setState(classifyCameraError(name));
    },
  );
});

app.append(title, startButton, video, status);
render();
