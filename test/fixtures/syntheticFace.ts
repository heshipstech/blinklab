import {
  IRIS_DIAMETER_MM,
  LANDMARK_COUNT,
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_CENTER_INDEX,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_CENTER_INDEX,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import type { EarIndexMap } from "../../src/core/ear";
import type { LandmarkPoint } from "../../src/core/facePresence";

// A face built from arithmetic, so geometry tests have an answer key.
//
// Conventions, written once, obeyed forever:
// - Face local frame in millimetres. Origin midway between the pupils.
//   +x runs toward the image RIGHT (the subject's left side),
//   +y runs toward the image BOTTOM, +z runs AWAY from the camera.
// - Rotations are applied in the order roll (around z), pitch
//   (around x), yaw (around y), then the face is placed at
//   distanceMm and projected through a pinhole with focal ratio 1:
//   u = 0.5 + x / z, v = 0.5 + y / z, a square normalised space.
// - Only the measurement landmarks are meaningful. Every other index
//   sits at the face origin, projecting to the frame centre.

export { IRIS_DIAMETER_MM };
export const EYE_WIDTH_MM = 30;
export const INTERPUPILLARY_MM = 63;

export type SyntheticFaceOptions = {
  distanceMm?: number;
  apertureMm?: number;
  rollDeg?: number;
  pitchDeg?: number;
  yawDeg?: number;
};

type P3 = { x: number; y: number; z: number };

function rotated(p: P3, rollDeg: number, pitchDeg: number, yawDeg: number): P3 {
  const roll = (rollDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const yaw = (yawDeg * Math.PI) / 180;

  // Roll, around z.
  let x = p.x * Math.cos(roll) - p.y * Math.sin(roll);
  let y = p.x * Math.sin(roll) + p.y * Math.cos(roll);
  let z = p.z;

  // Pitch, around x.
  const y2 = y * Math.cos(pitch) - z * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z * Math.cos(pitch);
  y = y2;
  z = z2;

  // Yaw, around y.
  const x3 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z3 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  x = x3;
  z = z3;

  return { x, y, z };
}

export function syntheticFace(
  options: SyntheticFaceOptions = {},
): LandmarkPoint[] {
  const distanceMm = options.distanceMm ?? 500;
  const apertureMm = options.apertureMm ?? 10;
  const rollDeg = options.rollDeg ?? 0;
  const pitchDeg = options.pitchDeg ?? 0;
  const yawDeg = options.yawDeg ?? 0;

  const halfIpd = INTERPUPILLARY_MM / 2;
  const halfEye = EYE_WIDTH_MM / 2;
  const halfIris = IRIS_DIAMETER_MM / 2;
  const halfAperture = apertureMm / 2;
  const chordOffset = 5;

  const points = new Map<number, P3>();

  // One eye's worth of local points around its pupil x position.
  function placeEye(
    pupilX: number,
    ear: EarIndexMap,
    irisCenter: number,
    irisRing: readonly number[],
    outerSign: -1 | 1,
  ): void {
    points.set(irisCenter, { x: pupilX, y: 0, z: 0 });
    points.set(irisRing[0] ?? -1, { x: pupilX + halfIris, y: 0, z: 0 });
    points.set(irisRing[1] ?? -1, { x: pupilX, y: -halfIris, z: 0 });
    points.set(irisRing[2] ?? -1, { x: pupilX - halfIris, y: 0, z: 0 });
    points.set(irisRing[3] ?? -1, { x: pupilX, y: halfIris, z: 0 });
    points.set(ear.outerCorner, {
      x: pupilX + outerSign * halfEye,
      y: 0,
      z: 0,
    });
    points.set(ear.innerCorner, {
      x: pupilX - outerSign * halfEye,
      y: 0,
      z: 0,
    });
    points.set(ear.upperOuter, {
      x: pupilX + outerSign * chordOffset,
      y: -halfAperture,
      z: 0,
    });
    points.set(ear.lowerOuter, {
      x: pupilX + outerSign * chordOffset,
      y: halfAperture,
      z: 0,
    });
    points.set(ear.upperInner, {
      x: pupilX - outerSign * chordOffset,
      y: -halfAperture,
      z: 0,
    });
    points.set(ear.lowerInner, {
      x: pupilX - outerSign * chordOffset,
      y: halfAperture,
      z: 0,
    });
  }

  // Subject's right eye sits at image left, negative x. Its outer
  // corner (the temple side) is further left still, hence sign -1.
  placeEye(
    -halfIpd,
    RIGHT_EYE_EAR_INDICES,
    RIGHT_IRIS_CENTER_INDEX,
    RIGHT_IRIS_RING_INDICES,
    -1,
  );
  placeEye(
    halfIpd,
    LEFT_EYE_EAR_INDICES,
    LEFT_IRIS_CENTER_INDEX,
    LEFT_IRIS_RING_INDICES,
    1,
  );

  const face: LandmarkPoint[] = [];
  for (let index = 0; index < LANDMARK_COUNT; index++) {
    const local = points.get(index) ?? { x: 0, y: 0, z: 0 };
    const turned = rotated(local, rollDeg, pitchDeg, yawDeg);
    const depth = distanceMm + turned.z;
    face.push({
      x: 0.5 + turned.x / depth,
      y: 0.5 + turned.y / depth,
      z: 0,
    });
  }
  return face;
}
