import { apertureMm } from "./aperture";
import {
  POSE_LIMITS,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "./constants";
import type { Point2 } from "./geometry";

// How much of a published millimetre is head angle. Roadmap 10.10c4c,
// ladder B12, audit F-086. The prediction was written before any of
// this existed and lives in docs/pose-aperture-bias.txt.
//
// Every millimetre this project publishes is
//
//   apertureMm = aperturePx * (IRIS_DIAMETER_MM / irisWidthPx)
//
// a VERTICAL lid opening divided by a HORIZONTAL iris width. The
// division is what makes the number independent of distance from the
// camera. It does nothing about which way the head is turned, and the
// validity gate accepts 20 degrees of pitch, 25 of yaw and 25 of roll,
// publishing every frame inside those limits as though pose did not
// matter.
//
// Numerator and denominator foreshorten on different axes, so they
// cannot cancel: a nod shrinks the opening and leaves the ruler alone,
// a turn shrinks the ruler and leaves the opening alone.
//
// The same arrangement as velocityBias.ts next door. The synthetic eye
// is fed to the REAL apertureMm with the real index sets, so this
// measures the instrument rather than a description of it.

/** A landmark before projection: the face plane is z = 0. */
type Point3 = { x: number; y: number; z: number };

/** A head angle in degrees, as the validity gate names them. */
export type Pose = { pitchDeg: number; yawDeg: number; rollDeg: number };

/** The frame the synthetic eye is measured in, and its own geometry. */
const FRAME_WIDTH_PX = 1280;
const FRAME_HEIGHT_PX = 720;
/** Iris radius in pixels at zero pose: a plausible webcam close-up. */
const IRIS_RADIUS_PX = 15;
/** Half the lid opening, and how far the two chords sit from centre. */
const LID_HALF_OPENING_PX = 7;
const CHORD_OFFSET_PX = 8;

/**
 * The eye at rest, in pixels on the face plane, centred on the origin.
 *
 * Only the landmarks `apertureMm` reads are placed. The iris ring's
 * first and third points are its horizontal diameter, which is the
 * ruler; the four lid points are the two vertical chords the opening
 * is the mean of.
 */
function restingEye(): Map<number, Point3> {
  const ring = RIGHT_IRIS_RING_INDICES;
  const ear = RIGHT_EYE_EAR_INDICES;
  const points = new Map<number, Point3>();
  points.set(ring[0] as number, { x: IRIS_RADIUS_PX, y: 0, z: 0 });
  points.set(ring[1] as number, { x: 0, y: IRIS_RADIUS_PX, z: 0 });
  points.set(ring[2] as number, { x: -IRIS_RADIUS_PX, y: 0, z: 0 });
  points.set(ring[3] as number, { x: 0, y: -IRIS_RADIUS_PX, z: 0 });
  points.set(ear.upperOuter, {
    x: -CHORD_OFFSET_PX,
    y: LID_HALF_OPENING_PX,
    z: 0,
  });
  points.set(ear.lowerOuter, {
    x: -CHORD_OFFSET_PX,
    y: -LID_HALF_OPENING_PX,
    z: 0,
  });
  points.set(ear.upperInner, {
    x: CHORD_OFFSET_PX,
    y: LID_HALF_OPENING_PX,
    z: 0,
  });
  points.set(ear.lowerInner, {
    x: CHORD_OFFSET_PX,
    y: -LID_HALF_OPENING_PX,
    z: 0,
  });
  return points;
}

const RADIANS = Math.PI / 180;

/**
 * One landmark under a head pose, projected and normalised.
 *
 * Pitch turns the face about the horizontal axis and yaw about the
 * vertical one, both in three dimensions before the projection drops
 * z. Roll is applied AFTER projection, in the image plane, because
 * that is what a tilted head does to a camera: rotating in normalised
 * coordinates instead would be rotating in a space the pixel
 * conversion stretches unevenly, which no head does.
 *
 * The projection is orthographic. A real camera is perspective, and
 * the perspective term depends on how far the face sits from the lens
 * — a parameter this simulation does not have and will not invent.
 * Whatever perspective adds, it adds on top of this.
 */
function project(point: Point3, pose: Pose): Point2 {
  const pitch = pose.pitchDeg * RADIANS;
  const yaw = pose.yawDeg * RADIANS;
  const roll = pose.rollDeg * RADIANS;
  // Pitch about x, then yaw about y.
  const y1 = point.y * Math.cos(pitch) - point.z * Math.sin(pitch);
  const z1 = point.y * Math.sin(pitch) + point.z * Math.cos(pitch);
  const x2 = point.x * Math.cos(yaw) + z1 * Math.sin(yaw);
  // Orthographic: z is dropped here.
  const rolledX = x2 * Math.cos(roll) - y1 * Math.sin(roll);
  const rolledY = x2 * Math.sin(roll) + y1 * Math.cos(roll);
  // Back to the normalised coordinates a landmarker emits, so that
  // `toPixels` inside the real function recovers these pixels exactly.
  return {
    x: 0.5 + rolledX / FRAME_WIDTH_PX,
    y: 0.5 + rolledY / FRAME_HEIGHT_PX,
  };
}

/** The face array `apertureMm` reads, at one pose. */
function faceAt(pose: Pose): Point2[] {
  const face: Point2[] = new Array<Point2>(478).fill({ x: 0.5, y: 0.5 });
  for (const [index, point] of restingEye()) {
    face[index] = project(point, pose);
  }
  return face;
}

/** What the instrument publishes for the synthetic eye at one pose. */
export function measuredApertureMm(pose: Pose): number {
  const measured = apertureMm(
    faceAt(pose),
    RIGHT_EYE_EAR_INDICES,
    RIGHT_IRIS_RING_INDICES,
    FRAME_WIDTH_PX,
    FRAME_HEIGHT_PX,
  );
  if (measured === null) {
    throw new Error("the synthetic eye produced no aperture");
  }
  return measured;
}

const REST: Pose = { pitchDeg: 0, yawDeg: 0, rollDeg: 0 };

/**
 * The published aperture at a pose, as a fraction of the truth.
 *
 * Above one: the number reads high. Below one: it reads low. The truth
 * is the same eye at zero pose, measured by the same function, so the
 * ratio isolates pose and nothing else.
 */
export function apertureRatioAt(pose: Pose): number {
  return measuredApertureMm(pose) / measuredApertureMm(REST);
}

/** The gate's own limits, as a pose on each axis alone. */
export const POSE_BIAS_CASES: readonly { name: string; pose: Pose }[] = [
  {
    name: "pitch at the gate's limit",
    pose: { pitchDeg: POSE_LIMITS.maxPitchDeg, yawDeg: 0, rollDeg: 0 },
  },
  {
    name: "yaw at the gate's limit",
    pose: { pitchDeg: 0, yawDeg: POSE_LIMITS.maxYawDeg, rollDeg: 0 },
  },
  {
    name: "roll at the gate's limit",
    pose: { pitchDeg: 0, yawDeg: 0, rollDeg: POSE_LIMITS.maxRollDeg },
  },
  {
    name: "every axis at the gate's limit",
    pose: {
      pitchDeg: POSE_LIMITS.maxPitchDeg,
      yawDeg: POSE_LIMITS.maxYawDeg,
      rollDeg: POSE_LIMITS.maxRollDeg,
    },
  },
];

/**
 * How wide the published aperture can swing inside the accepted pose
 * region, as a fraction: the highest ratio over the lowest.
 *
 * Searched over the corners and the axes rather than assumed to sit at
 * one of them, because the two live axes move the number in opposite
 * directions and the extreme need not be a corner.
 */
export function poseBiasSpan(): { low: number; high: number } {
  const angles = (limit: number): number[] => [
    -limit,
    -limit / 2,
    0,
    limit / 2,
    limit,
  ];
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const pitchDeg of angles(POSE_LIMITS.maxPitchDeg)) {
    for (const yawDeg of angles(POSE_LIMITS.maxYawDeg)) {
      for (const rollDeg of angles(POSE_LIMITS.maxRollDeg)) {
        const ratio = apertureRatioAt({ pitchDeg, yawDeg, rollDeg });
        low = Math.min(low, ratio);
        high = Math.max(high, ratio);
      }
    }
  }
  return { low, high };
}
