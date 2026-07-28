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
