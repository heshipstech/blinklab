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

// The calibration capture of 5.4a. Samples taken while the eye is
// still travelling toward a fresh dot would poison the calibration,
// so nothing counts until the settle window has passed.
export const CALIBRATION_SETTLE_MS = 800;
export const CALIBRATION_SAMPLES_PER_TARGET = 30;

// The on screen boundary of 5.3. Corner glances observed on the
// owner's setup swing about 0.05 to 0.15 of an eye width, true look
// aways exceed it. Calibration at 5.4 will earn a better number.
export const OFF_SCREEN_OFFSET_THRESHOLD = 0.18;

// The blink event log of 4.8 had ONE cap serving two masters, and that
// is what broke the first external validation. A panel that shows the
// last fifty blinks is a reasonable panel. A recorded measurement that
// silently deletes its oldest rows is not a measurement. The single
// number did both jobs, so the export inherited the panel's limit: two
// Eyeblink8 clips ran past fifty blinks and their opening stretches,
// 58 real detections, were dropped before the file was written. The
// score that came back read as a detector missing blinks it had in
// fact found.
//
// So there are two numbers now, and they are different KINDS of thing.

// What the on screen list shows. Purely a reading comfort, and it may
// be changed freely, because nothing downstream depends on it.
export const BLINK_LOG_DISPLAY_CAP = 50;

// What the record holds. High enough that no plausible session reaches
// it: at a resting rate near 12 blinks a minute this is about 27 hours
// of continuous measurement. It is a ceiling on memory, not an
// editorial choice, and unlike the old cap it cannot be reached
// quietly. Anything lost past it is counted and declared in the
// exported file, because a measurement that loses data has to say so.
export const BLINK_LOG_RECORD_CAP = 20000;

// The squint separation of 4.7. A blink's closed phase is brief,
// yours measured 133 and 117 ms. Beyond half a second below the
// threshold, the eye is not blinking, it is closed, a different
// phenomenon that 6.2 detects in its own right.
export const MAX_BLINK_DURATION_MS = 500;

// The arming gap of fix #114. One line plus measurement noise mints
// events: the owner's log filled with 17 ms, 0.1 mm "blinks" while
// their aperture sat at 3.7 mm against a 3.8 mm threshold (the
// 2026-08-05 session recorded in issues #112 and #114). So a
// closure only arms as a blink once it reaches the threshold minus
// this fraction: at that session's threshold, a 0.38 mm proving
// depth, comfortably past the 0.1 to 0.2 mm chatter, while real
// blinks plunge millimetres below it.
// The gap sits BELOW the line on purpose: an earlier design put it
// above, as a reopen latch, and review proved a latch corrupts
// durations. Depth arming never changes when a closure ends.
export const APERTURE_HYSTERESIS_FRACTION = 0.1;

// The frame rate honesty gate of 4.6. A fast blink's closed phase
// can be under 100 ms; below 25 fps it may fall entirely between
// frames, and a count that missed blinks would read as calm.
export const MIN_BLINK_FPS = 25;

// The blink rate window of 4.4. Rates from very young windows are
// arithmetic nonsense, one blink in two seconds reads as thirty per
// minute, so no rate exists before the observation minimum.
export const BLINK_RATE_WINDOW_MS = 60000;
export const BLINK_RATE_MIN_OBSERVATION_MS = 15000;

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

// The ratchet's ceiling, fix #126. The baseline is a p90, and a p90
// is exactly what a brief excursion moves: sixty frames of surprise
// in a six hundred frame window lift it a long way, and since the
// baseline never falls, that lift lasts the whole session. Once half
// the baseline exceeds the resting aperture, the blink line sits
// ABOVE the open eye, every closure is timed from a crossing that
// happened at rest, durations inflate and shapes flatten. That is
// what the owner's own session did: a 10.7 mm baseline over a 5.25 mm
// resting eye.
//
// The MEDIAN of the same window barely moves under a brief
// excursion, which is what makes it a good ceiling. At 1.4 the blink
// line can never exceed seventy percent of the typical open
// aperture, while an ordinary session's p90 to median ratio is about
// 1.12, so nothing is constrained where nothing was broken.
export const BASELINE_MEDIAN_CEILING_FACTOR = 1.4;
export const BASELINE_MEDIAN_PERCENTILE = 50;

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
