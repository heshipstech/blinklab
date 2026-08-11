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
  | { kind: "clipFailed"; reason: string }
  // The measuring model failed to load. Remediation B2: before this
  // state existed, the failure was swallowed into the console and a
  // camera session ran forever looking healthy while nothing could
  // ever be measured. Distinct from "failed" for the same reason
  // clipFailed is: the camera is innocent, and the fix is a retry
  // of the load, not a visit to permission settings.
  | { kind: "modelFailed" }
  // The measurement loop itself threw. Remediation B3: before this
  // state existed, a throw inside the frame handler killed the loop
  // and the page froze silently, every readout stuck on its last
  // value. The reason is carried because the operator is being asked
  // to reload and deserves to know why.
  | { kind: "measurementFailed"; reason: string };

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
    case "modelFailed":
      // Names the model, the consequence, and the way back. It must
      // not mention the camera: sending someone to their permission
      // settings for a failed load teaches them the wrong lesson.
      // "Could not be loaded", not "could not be downloaded": the
      // loader also fails on machines whose graphics stack refuses
      // the model, and this message cannot see which happened. The
      // network is named as a hint, not asserted as the cause.
      return 'The measuring model could not be loaded, so nothing can be measured. This is often a network problem. Check your connection, then click "Retry loading the model".';
    case "measurementFailed":
      // Three facts and nothing more: it stopped, what was recorded
      // survived, reload for a fresh start. "Anything recorded" and
      // not "the data", because a crash can land before a single
      // record exists, and a promise of data that is not there would
      // contradict the disabled export buttons beside it. The reason
      // is included because "internal error" alone teaches nobody
      // anything and cannot be reported.
      return `Measurement stopped because of an internal error (${state.reason}). Anything recorded before the stop is kept for export. Reload the page to measure again.`;
  }
}
