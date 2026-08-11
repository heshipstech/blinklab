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

describe("the pose limits, pinned by literal degrees (remediation C1)", () => {
  // Every test above derives its angles FROM the constants, so it
  // moves when they move: the audit bent pitch to 89 degrees and to
  // 1 degree and the suite stayed green both times. These literals
  // are the pin. Changing a limit is allowed, but it must arrive
  // here consciously, with these numbers, not slip through. The
  // valid probes sit AT each limit, because at-limit-valid is the
  // gate's convention (strictly beyond refuses): review found the
  // first draft probing one degree inside, which left a one-degree
  // tightening invisible to the whole suite.
  const level = { pitchDeg: 0, yawDeg: 0, rollDeg: 0 };

  it("pitch: 20 degrees measures, 21 refuses, either sign", () => {
    expect(poseValidity({ ...level, pitchDeg: 20 }).kind).toBe("valid");
    expect(poseValidity({ ...level, pitchDeg: -20 }).kind).toBe("valid");
    expect(poseValidity({ ...level, pitchDeg: 21 }).kind).toBe("invalid");
    expect(poseValidity({ ...level, pitchDeg: -21 }).kind).toBe("invalid");
  });

  it("roll: 25 degrees measures, 26 refuses, either sign", () => {
    expect(poseValidity({ ...level, rollDeg: 25 }).kind).toBe("valid");
    expect(poseValidity({ ...level, rollDeg: -25 }).kind).toBe("valid");
    expect(poseValidity({ ...level, rollDeg: 26 }).kind).toBe("invalid");
    expect(poseValidity({ ...level, rollDeg: -26 }).kind).toBe("invalid");
  });

  it("yaw: 25 degrees measures, 26 refuses, either sign", () => {
    expect(poseValidity({ ...level, yawDeg: 25 }).kind).toBe("valid");
    expect(poseValidity({ ...level, yawDeg: -25 }).kind).toBe("valid");
    expect(poseValidity({ ...level, yawDeg: 26 }).kind).toBe("invalid");
    expect(poseValidity({ ...level, yawDeg: -26 }).kind).toBe("invalid");
  });
});
