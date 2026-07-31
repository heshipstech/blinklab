import { describe, expect, it } from "vitest";

import { POSE_LIMITS } from "../../src/core/constants";
import { poseValidity, poseValidityMessage } from "../../src/core/validityGate";

const level = { pitchDeg: 0, yawDeg: 0, rollDeg: 0 };

describe("poseValidity", () => {
  it("accepts a level head", () => {
    expect(poseValidity(level)).toEqual({ kind: "valid" });
  });

  it("runs the boundary trio on yaw: below, exactly at, just over", () => {
    const limit = POSE_LIMITS.maxYawDeg;
    expect(poseValidity({ ...level, yawDeg: limit - 1 }).kind).toBe("valid");
    expect(poseValidity({ ...level, yawDeg: limit }).kind).toBe("valid");
    expect(poseValidity({ ...level, yawDeg: limit + 0.1 }).kind).toBe(
      "invalid",
    );
  });

  it("rejects each axis on its own, negative directions included", () => {
    expect(
      poseValidity({ ...level, pitchDeg: -(POSE_LIMITS.maxPitchDeg + 5) }),
    ).toMatchObject({ kind: "invalid", axis: "pitch" });
    expect(
      poseValidity({ ...level, yawDeg: POSE_LIMITS.maxYawDeg + 5 }),
    ).toMatchObject({ kind: "invalid", axis: "yaw" });
    expect(
      poseValidity({ ...level, rollDeg: -(POSE_LIMITS.maxRollDeg + 5) }),
    ).toMatchObject({ kind: "invalid", axis: "roll" });
  });

  it("treats a missing pose as invalid, unknown is not acceptable", () => {
    expect(poseValidity(null)).toEqual({ kind: "noPose" });
  });
});

describe("poseValidityMessage", () => {
  it("stays silent while valid", () => {
    expect(poseValidityMessage({ kind: "valid" })).toBe("");
  });

  it("names the axis, the value and the limit when invalid", () => {
    const message = poseValidityMessage({
      kind: "invalid",
      axis: "yaw",
      valueDeg: 32,
      limitDeg: 25,
    });
    expect(message).toContain("yaw");
    expect(message).toContain("32");
    expect(message).toContain("25");
  });

  it("explains an unknown pose readably", () => {
    expect(poseValidityMessage({ kind: "noPose" }).length).toBeGreaterThan(10);
  });
});
