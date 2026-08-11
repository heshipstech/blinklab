import { describe, expect, it } from "vitest";

import {
  cameraStateMessage,
  classifyCameraError,
  type CameraState,
} from "../../src/core/cameraState";

describe("classifyCameraError", () => {
  it("classifies a denied permission", () => {
    expect(classifyCameraError("NotAllowedError")).toEqual({ kind: "denied" });
    expect(classifyCameraError("PermissionDeniedError")).toEqual({
      kind: "denied",
    });
  });

  it("classifies a missing camera", () => {
    expect(classifyCameraError("NotFoundError")).toEqual({ kind: "noCamera" });
  });

  it("keeps unknown errors as a failed state with the reason preserved", () => {
    expect(classifyCameraError("SomethingOddError")).toEqual({
      kind: "failed",
      reason: "SomethingOddError",
    });
  });
});

describe("cameraStateMessage", () => {
  it("gives every non running state a readable sentence", () => {
    const states: CameraState[] = [
      { kind: "idle" },
      { kind: "requesting" },
      { kind: "denied" },
      { kind: "noCamera" },
      { kind: "failed", reason: "AbortError" },
      { kind: "modelFailed" },
      { kind: "measurementFailed", reason: "boom" },
    ];
    for (const state of states) {
      expect(cameraStateMessage(state).length).toBeGreaterThan(10);
    }
  });

  it("stays silent while the camera runs", () => {
    expect(cameraStateMessage({ kind: "running" })).toBe("");
  });

  it("tells a denied user how to recover", () => {
    expect(cameraStateMessage({ kind: "denied" })).toContain(
      "browser settings",
    );
  });
});

describe("a model that will not download", () => {
  it("names the model and the retry, and leaves the camera out of it", () => {
    // Remediation B2. The failure is a download, the remedy is a
    // retry, and the camera is innocent: the message must not send
    // anyone toward permission settings, the way the camera states
    // rightly do for their own failures.
    const message = cameraStateMessage({ kind: "modelFailed" });
    expect(message).toContain("model");
    expect(message).toContain("Retry loading the model");
    expect(message).toContain("nothing can be measured");
    expect(message).not.toContain("camera");
    expect(message).not.toContain("permission");
  });
});

describe("a measurement loop that crashed", () => {
  it("carries the reason, promises the data, and asks for a reload", () => {
    // Remediation B3. Before this state, a throw in the frame
    // handler froze the page silently. The message must name the
    // error (an unnamed internal error can never be reported), say
    // the recorded data survived, and give the one recovery step.
    const message = cameraStateMessage({
      kind: "measurementFailed",
      reason: "canvas is gone",
    });
    expect(message).toContain("canvas is gone");
    expect(message).toContain("kept");
    expect(message).toContain("Reload the page");
    expect(message).not.toContain("permission");
  });
});

describe("a clip that will not load", () => {
  it("speaks about the file rather than about the camera", () => {
    // Wrapping this in the camera's message would send someone to
    // their browser permissions to fix a file they should re-export.
    const message = cameraStateMessage({
      kind: "clipFailed",
      reason:
        "This browser could not decode clip.avi. Try an MP4 or WebM file.",
    });
    expect(message).toBe(
      "This browser could not decode clip.avi. Try an MP4 or WebM file.",
    );
    expect(message).not.toContain("camera");
  });
});
