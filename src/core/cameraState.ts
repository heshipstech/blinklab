export type CameraState =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "running" }
  | { kind: "denied" }
  | { kind: "noCamera" }
  | { kind: "failed"; reason: string }
  // A clip that would not load is not a camera problem, and saying
  // "the camera could not start" would send someone to their browser
  // permissions to fix a file they should simply re-export.
  | { kind: "clipFailed"; reason: string };

export function classifyCameraError(errorName: string): CameraState {
  switch (errorName) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return { kind: "denied" };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return { kind: "noCamera" };
    default:
      return { kind: "failed", reason: errorName };
  }
}

export function cameraStateMessage(state: CameraState): string {
  switch (state.kind) {
    case "idle":
      return 'The camera is off. Click "Start camera" to begin.';
    case "requesting":
      return "Waiting for your answer to the camera permission prompt.";
    case "running":
      return "";
    case "denied":
      return "Camera permission was denied. To use blinklab, allow camera access for this site in your browser settings, then reload the page.";
    case "noCamera":
      return "No camera was found on this device. Connect one and reload the page.";
    case "failed":
      return `The camera could not start (${state.reason}). Reload the page and try again.`;
    case "clipFailed":
      // The reason arrives already written for a person to read, so it
      // is passed through rather than wrapped in more apology.
      return state.reason;
  }
}
