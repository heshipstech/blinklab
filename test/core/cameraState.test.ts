import { describe, expect, it } from "vitest";

import {
  cameraStateMessage,
  classifyCameraError,
  sessionOver,
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
      { kind: "loadingClip" },
      { kind: "denied" },
      { kind: "noCamera" },
      { kind: "failed", reason: "AbortError" },
      { kind: "modelFailed" },
      { kind: "measurementFailed", reason: "boom" },
      { kind: "ended" },
    ];
    for (const state of states) {
      expect(cameraStateMessage(state).length).toBeGreaterThan(10);
    }
  });

  it("a session that has ended says what is still on offer and the way back", () => {
    // Roadmap 14.0a (audit F-015, F-057). Stop used to drop the page
    // into idle, whose sentence invites a fresh start while the
    // exports beside it went grey and the records were one click from
    // being wiped. Ended is its own state: the session is over, what
    // it recorded is kept, and the camera may be started again.
    const message = cameraStateMessage({ kind: "ended" });
    expect(message).toContain("ended");
    expect(message).toMatch(/export/i);
    expect(message).toContain("Start camera");
    expect(message).not.toMatch(/permission|could not/i);
  });
});

describe("sessionOver, the states that keep a session's record on offer", () => {
  it("is true for an ended session and for one that crashed with its data kept", () => {
    expect(sessionOver({ kind: "ended" })).toBe(true);
    expect(sessionOver({ kind: "measurementFailed", reason: "boom" })).toBe(
      true,
    );
  });

  it("is false while running, before a session, and for every refusal", () => {
    const states: CameraState[] = [
      { kind: "idle" },
      { kind: "requesting" },
      { kind: "loadingClip" },
      { kind: "running" },
      { kind: "denied" },
      { kind: "noCamera" },
      { kind: "failed", reason: "AbortError" },
      { kind: "clipFailed", reason: "no" },
      { kind: "modelFailed" },
    ];
    for (const state of states) {
      expect(sessionOver(state)).toBe(false);
    }
  });

  it("loading a clip never mentions the camera or its permissions", () => {
    // Loading a clip used to show the "requesting" state, whose text is
    // about the camera permission prompt — a lie that lasted
    // milliseconds while the loader resolved on bare metadata. Once
    // loading honestly waits for decodable frames, a large clip shows
    // this state for many seconds, so the sentence must describe the
    // actual wait.
    const message = cameraStateMessage({ kind: "loadingClip" });
    expect(message).toContain("clip");
    expect(message).not.toMatch(/camera|permission/i);
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
