import { POSE_LIMITS } from "./constants";
import type { HeadPose } from "./headPose";

// The gate that lets measurements refuse. Beyond the pose limits the
// eye landmarks foreshorten and occlude, and a number computed from
// them would be a guess wearing a number's clothes.
export type PoseValidity =
  | { kind: "valid" }
  | {
      kind: "invalid";
      axis: "pitch" | "yaw" | "roll";
      valueDeg: number;
      limitDeg: number;
    }
  | { kind: "noPose" };

export function poseValidity(pose: HeadPose | null): PoseValidity {
  if (pose === null) {
    return { kind: "noPose" };
  }
  const checks = [
    {
      axis: "pitch",
      valueDeg: pose.pitchDeg,
      limitDeg: POSE_LIMITS.maxPitchDeg,
    },
    { axis: "yaw", valueDeg: pose.yawDeg, limitDeg: POSE_LIMITS.maxYawDeg },
    { axis: "roll", valueDeg: pose.rollDeg, limitDeg: POSE_LIMITS.maxRollDeg },
  ] as const;
  for (const check of checks) {
    if (Math.abs(check.valueDeg) > check.limitDeg) {
      return {
        kind: "invalid",
        axis: check.axis,
        valueDeg: check.valueDeg,
        limitDeg: check.limitDeg,
      };
    }
  }
  return { kind: "valid" };
}

export function poseValidityMessage(validity: PoseValidity): string {
  switch (validity.kind) {
    case "valid":
      return "";
    case "invalid":
      return `Head turned too far: ${validity.axis} is ${validity.valueDeg.toFixed(0)}°, limit ${String(validity.limitDeg)}°. Eye measurements paused until you face the camera again.`;
    case "noPose":
      return "Head pose unknown. Eye measurements paused.";
  }
}
