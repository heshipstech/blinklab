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
video.width = 640;
video.hidden = true;

const status = document.createElement("p");

startButton.addEventListener("click", () => {
  status.textContent = "Requesting camera permission...";
  startCamera(video).then(
    () => {
      video.hidden = false;
      startButton.hidden = true;
      status.textContent = "";
    },
    (error: unknown) => {
      // Readable degraded states are increment 1.2's job.
      status.textContent = `Camera could not start. ${String(error)}`;
    },
  );
});

app.append(title, startButton, video, status);
