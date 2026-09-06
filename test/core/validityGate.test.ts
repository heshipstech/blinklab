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

  // Roadmap 10.1c, ladder D2. Every probe above is computed FROM the
  // limits, so the September audit bent pitch to 89 degrees and to 1
  // with the whole suite green: a gate open enough to measure a face
  // in profile, and a gate shut enough to refuse every real one, both
  // invisible. These are literals. Pitch is 20 because the aperture is
  // read as a distance between landmarks and foreshortening shrinks it;
  // yaw and roll are 25.
  it("holds pitch at 20 degrees, as literals in both directions", () => {
    expect(poseValidity({ ...level, pitchDeg: 20 }).kind).toBe("valid");
    expect(poseValidity({ ...level, pitchDeg: -20 }).kind).toBe("valid");
    expect(poseValidity({ ...level, pitchDeg: 20.1 }).kind).toBe("invalid");
    expect(poseValidity({ ...level, pitchDeg: -20.1 }).kind).toBe("invalid");
    // A gate opened to 89 would call a face in profile measurable, and
    // a gate shut to 1 would refuse an ordinary seated head.
    expect(poseValidity({ ...level, pitchDeg: 45 }).kind).toBe("invalid");
    expect(poseValidity({ ...level, pitchDeg: 2 }).kind).toBe("valid");
  });

  it("holds yaw and roll at 25 degrees, as literals in both directions", () => {
    for (const axis of ["yawDeg", "rollDeg"] as const) {
      expect(poseValidity({ ...level, [axis]: 25 }).kind).toBe("valid");
      expect(poseValidity({ ...level, [axis]: -25 }).kind).toBe("valid");
      expect(poseValidity({ ...level, [axis]: 25.1 }).kind).toBe("invalid");
      expect(poseValidity({ ...level, [axis]: -25.1 }).kind).toBe("invalid");
      expect(poseValidity({ ...level, [axis]: 45 }).kind).toBe("invalid");
      expect(poseValidity({ ...level, [axis]: 2 }).kind).toBe("valid");
    }
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
