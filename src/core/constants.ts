// Landmark indices from MediaPipe's face mesh topology.
// Left and right mean the SUBJECT's left and right. On an unmirrored
// image the subject's right eye appears on the image's left side.

export const LANDMARK_COUNT = 478;

// SPEC.md performance budget: model inference per frame, modern laptop.
export const INFERENCE_BUDGET_MS = 30;

// Eyelid contour of the subject's right eye, 16 points around the rim.
export const RIGHT_EYE_INDICES: readonly number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];

// Eyelid contour of the subject's left eye, 16 points around the rim.
export const LEFT_EYE_INDICES: readonly number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388,
  466,
];

// Iris topology: a centre point, then its four rim points in the
// order right, top, left, bottom. Subject's right iris comes first.
export const RIGHT_IRIS_CENTER_INDEX = 468;
export const RIGHT_IRIS_RING_INDICES: readonly number[] = [469, 470, 471, 472];
export const LEFT_IRIS_CENTER_INDEX = 473;
export const LEFT_IRIS_RING_INDICES: readonly number[] = [474, 475, 476, 477];
