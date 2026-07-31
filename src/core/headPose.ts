// Head pose from the model's facial transformation matrix. The model
// reports how the canonical face is turned in camera space as a 4x4
// matrix; this unpacks its rotation into three named angles.
//
// Convention, matching the synthetic generator: roll turns about z
// (in plane), pitch about x, yaw about y, composed as M = Ry Rx Rz,
// roll applied first. The matrix data is read row major, rotation in
// the upper left 3x3.

export type HeadPose = {
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
};

const GIMBAL_EPSILON = 1e-6;

export function eulerFromMatrix(data: readonly number[]): HeadPose | null {
  if (data.length !== 16) {
    return null;
  }
  const m = (row: number, col: number) => data[row * 4 + col] ?? 0;

  // From M = Ry Rx Rz: m(1,2) = -sin(pitch).
  const sinPitch = -m(1, 2);
  const clamped = Math.min(Math.max(sinPitch, -1), 1);
  const pitch = Math.asin(clamped);

  // Near gimbal lock, yaw and roll blur into one axis. Refuse to
  // pretend the split is knowable.
  if (Math.abs(Math.cos(pitch)) < GIMBAL_EPSILON) {
    return null;
  }

  const yaw = Math.atan2(m(0, 2), m(2, 2));
  const roll = Math.atan2(m(1, 0), m(1, 1));

  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  return {
    pitchDeg: toDeg(pitch),
    yawDeg: toDeg(yaw),
    rollDeg: toDeg(roll),
  };
}
