// Landmark indices from MediaPipe's face mesh topology.
// Left and right mean the SUBJECT's left and right. On an unmirrored
// image the subject's right eye appears on the image's left side.

export const LANDMARK_COUNT = 478;

// SPEC.md performance budget: model inference per frame, modern laptop.
export const INFERENCE_BUDGET_MS = 30;

// The ruler humans are born with: the visible iris is close to
// 11.7 mm across in almost every adult, stable from early childhood.
export const IRIS_DIAMETER_MM = 11.7;

// The fixed blink threshold of increment 4.1. The owner's fixture
// showed full blinks bottoming near 2.2 mm and a shallow blink near
// 5, with an open median around 7. Four sits in the stable band,
// every threshold from 3 to 4.5 finds the same two full blinks.
export const BLINK_APERTURE_THRESHOLD_MM = 4;

// The personal baseline of increment 4.2: thirty seconds of watching
// learns what this person's open eyes measure. The threshold becomes
// half of that. The 90th percentile keeps brief blinks from lowering
// the estimate of "open".
export const BASELINE_LEARN_MS = 30000;
export const BASELINE_MIN_SAMPLES = 100;
export const BASELINE_PERCENTILE = 90;
export const BASELINE_THRESHOLD_FRACTION = 0.5;
export const BASELINE_RECENT_CAP = 600;
export const BASELINE_RISE_MIN_SAMPLES = 300;

// Beyond these head angles, eye landmarks foreshorten and occlude
// enough that measurements would be guesses. Symmetric on purpose,
// so axis sign conventions never matter to the gate.
export const POSE_LIMITS = {
  maxPitchDeg: 20,
  maxYawDeg: 25,
  maxRollDeg: 25,
} as const;

// Eyelid contour of the subject's right eye, 16 points around the rim.
export const RIGHT_EYE_INDICES: readonly number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];

// Eyelid contour of the subject's left eye, 16 points around the rim.
export const LEFT_EYE_INDICES: readonly number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388,
  466,
];

// The six canonical points for the eye aspect ratio, drawn from the
// contour sets above: the two corners, and two vertical lid pairs.
export const RIGHT_EYE_EAR_INDICES = {
  outerCorner: 33,
  innerCorner: 133,
  upperOuter: 160,
  lowerOuter: 144,
  upperInner: 158,
  lowerInner: 153,
} as const;

export const LEFT_EYE_EAR_INDICES = {
  outerCorner: 263,
  innerCorner: 362,
  upperOuter: 387,
  lowerOuter: 373,
  upperInner: 385,
  lowerInner: 380,
} as const;

// Iris topology: a centre point, then its four rim points in the
// order right, top, left, bottom. Subject's right iris comes first.
export const RIGHT_IRIS_CENTER_INDEX = 468;
export const RIGHT_IRIS_RING_INDICES: readonly number[] = [469, 470, 471, 472];
export const LEFT_IRIS_CENTER_INDEX = 473;
export const LEFT_IRIS_RING_INDICES: readonly number[] = [474, 475, 476, 477];
