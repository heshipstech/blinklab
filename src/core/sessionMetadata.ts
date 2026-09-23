import {
  GAZE_R2_BOUND,
  GAZE_RMS_BOUND,
  type ProfileQuality,
} from "./calibrationProfile";
import type { CalibrationWindow } from "./calibrationWindow";
import { CUE_RESPONSE_WINDOW_MS, type Cue } from "./cueSchedule";
import type { DeliveryRates } from "./deliveryRate";
import type { FramesMissedSummary } from "./framesMissed";
import { FEATURE_RECORD_CAP, type FeatureRecord } from "./featureRecord";
import { LIGHT_CYCLES, LIGHT_PHASE_MS, LIGHT_SETTLE_MS } from "./lightSchedule";
import { PERCLOS_MIN_OBSERVED_MS, PERCLOS_MIN_SAMPLES } from "./perclos";
import { percentile } from "./statistics";
import { reduceUserAgent } from "./userAgent";

// What the conditions of a measurement were, written into the export
// beside the measurement itself.
//
// Until 15 August a camera session's export said `source: camera` and
// almost nothing else: `duration_seconds` and `measured_fps` were only
// ever filled in for clips, so a live session carried no rate at all
// and no word about the camera that produced it. Six exports from six
// people would have been six anonymous columns of millimetres with no
// way to tell a full-frame mirrorless at 60 fps from a 480p laptop cam
// in a dim room.
//
// A measurement without its conditions is not a measurement, it is a
// number. This module turns the conditions into the same `# key: value`
// rows the source, coverage and KSS metadata already use.
//
// Everything here is pure. Reading the browser for a DeviceInfo lives
// in io/deviceInfo.ts, so the sentence-building can be tested without
// a camera, which is the only way these strings ever get checked.

/**
 * What the browser can tell us about the machine alone.
 *
 * Its own type because a clip session has one too. A clip runs with no
 * camera, but it runs in a browser on a computer, and the corpus results
 * are exactly the files that need to say which (roadmap 13.5's "machine
 * rows unconditional", remediation D8).
 */
export type MachineInfo = {
  userAgent: string | null;
  hardwareConcurrency: number | null;
  viewportWidthPx: number | null;
  viewportHeightPx: number | null;
  screenWidthPx: number | null;
  screenHeightPx: number | null;
  devicePixelRatio: number | null;
  orientation: string | null;
};

/** What the browser can tell us about the camera and the machine. */
export type DeviceInfo = MachineInfo & {
  /** The camera's own name, e.g. "FaceTime HD Camera". */
  cameraLabel: string | null;
  /** Negotiated capture size, which is not always what was asked for. */
  cameraWidthPx: number | null;
  cameraHeightPx: number | null;
  /**
   * The rate the CAMERA says it is configured to deliver.
   *
   * This is the number the page has never had. The on-screen processing
   * rate is the browser's animation pace, so a 15 fps camera behind a
   * 60 Hz display reads about 60 and the 25 fps blink gate stays open.
   * Remediation D1 is about wiring a true rate into that gate; this
   * records the camera's own claim so the blast radius of doing so can
   * be measured on real hardware before it ships.
   */
  cameraDeclaredFps: number | null;
  /** "user" or "environment". Only meaningful on a phone. */
  facingMode: string | null;
};

/**
 * A moment the person marked during the session.
 *
 * The reason this exists is a flaw in the six-person validation
 * protocol it was built for. That protocol asks for ten deliberate
 * blinks, so that ten is known ground truth. Finding those ten in the
 * export means looking for a burst of ten detections, which fails
 * exactly when the instrument MISSED them, which is the case worth
 * measuring. Using the instrument's output to locate the event that
 * tests the instrument is circular. A marker breaks the circle: the
 * truth is "ten blinks between marker 1 and marker 2", whatever the
 * instrument thought.
 */
/** The frame the face model actually read, which display size never changes. */
export type MeasurementFrame = {
  widthPx: number;
  heightPx: number;
};

export type SessionMarker = {
  atMs: number;
  index: number;
  /**
   * The visibility-change counter at the moment of marking. The
   * counter alone says the record has a gap somewhere; the counter AT
   * each marker says which side of the marks it sits on, which is
   * what lets an analysis decide whether the marked window itself was
   * disturbed instead of shrugging over the whole session
   * (docs/assessment-pilot-plan.md).
   */
  visibilityChangesAt: number;
};

/**
 * How many frames the pose gate judged, and how many it passed. Kept
 * as the two counts rather than a precomputed fraction so the pure
 * function decides what zero judged frames means: unknown, never 0.0.
 */
export type PoseFrameCounts = {
  gated: number;
  valid: number;
};

/**
 * The protocol this build's exports belong to: the pilot plan and the
 * date it was merged. A provenance statement about the app, not a
 * claim that any given session followed the protocol's steps — the
 * plan's own rule 6 is that the steps live in the document, not in
 * an enforcing sequencer.
 */
export const PROTOCOL_ID = "docs/assessment-pilot-plan.md, 29 August 2026";

/**
 * The iris width sample cap, following BLINK_LOG_RECORD_CAP's precedent
 * rather than inventing a second convention. A three minute session at
 * 60 frames per second is about 10,800 samples, so this does not bind
 * in practice, and the metadata says so out loud when it does.
 */
export const IRIS_SAMPLE_CAP = 20000;

function line(key: string, value: string | number | null): string {
  return `# ${key}: ${value === null ? "unknown" : value}`;
}

/**
 * The camera and machine rows. Every field says "unknown" rather than
 * vanishing.
 *
 * `fullUserAgent` defaults to false, and the default is the point.
 * Roadmap 10.0a2, ladder B2: the whole `navigator.userAgent` names the
 * browser build, the engine build and often the operating system patch
 * level, which together identify a machine rather than describe one,
 * and this project asks participants to email these files. The coarse
 * form carries what the analysis reads. Whichever form is written, a
 * `user_agent_form` row says which, so a reader of the file is never
 * left deciding whether a short string is a reduction or a browser
 * that says little.
 *
 * The camera rows are conditional and the machine rows are not (roadmap
 * 13.5, remediation D8). A clip has no camera and says so in one row,
 * but it still ran in a browser on a machine. A clip export that
 * dropped the browser, the core count and the pixel ratio left every
 * corpus result silent on what it ran on. `clipMachine` is that
 * machine, read when the clip started, and is used only when `info` is
 * null. Null there still writes the rows, reading "unknown", because
 * the rows are a promise.
 */
export function deviceMetadataRows(
  info: DeviceInfo | null,
  fullUserAgent = false,
  clipMachine: MachineInfo | null = null,
): string[] {
  if (info === null) {
    // A clip run has no camera. Saying so beats omitting the block and
    // leaving a reader to wonder whether it was dropped or never existed.
    return [
      line("camera", "none, not a camera session"),
      ...machineRows(clipMachine, fullUserAgent),
    ];
  }
  const size =
    info.cameraWidthPx === null || info.cameraHeightPx === null
      ? null
      : `${info.cameraWidthPx}x${info.cameraHeightPx}`;
  return [
    line("camera", info.cameraLabel),
    line("camera_resolution", size),
    line("camera_declared_fps", info.cameraDeclaredFps),
    line("facing_mode", info.facingMode),
    ...machineRows(info, fullUserAgent),
  ];
}

/** The machine's rows, the same seven for a camera session and a clip. */
function machineRows(
  machine: MachineInfo | null,
  fullUserAgent: boolean,
): string[] {
  const size = (width: number | null, height: number | null) =>
    width === null || height === null ? null : `${width}x${height}`;
  const userAgent = machine?.userAgent ?? null;
  return [
    line("user_agent", fullUserAgent ? userAgent : reduceUserAgent(userAgent)),
    line("user_agent_form", fullUserAgent ? "full" : "reduced"),
    line("hardware_concurrency", machine?.hardwareConcurrency ?? null),
    line(
      "viewport",
      size(machine?.viewportWidthPx ?? null, machine?.viewportHeightPx ?? null),
    ),
    line(
      "screen",
      size(machine?.screenWidthPx ?? null, machine?.screenHeightPx ?? null),
    ),
    line("device_pixel_ratio", machine?.devicePixelRatio ?? null),
    line("orientation", machine?.orientation ?? null),
  ];
}

/**
 * What the CAMERA delivered, beside what the page processed.
 *
 * Null for a clip, which is stepped off its own media clock and has no
 * camera: writing "unknown" there would invite a reader to look for a
 * delivery rate that never existed. For a camera these three rows are
 * written whatever they say, because "unknown" is the honest answer on
 * a browser without a delivery callback and a silent omission is not.
 *
 * These are the rows that will decide the prediction committed in
 * docs/blink-sample-rate.txt, so they carry more decimals than the
 * page shows: the page rounds to whole frames because a viewer is
 * reading a sentence, and the file keeps a tenth because somebody will
 * subtract two of them.
 */
export function deliveryMetadataRows(rates: DeliveryRates | null): string[] {
  if (rates === null) {
    return [];
  }
  return [
    line(
      "camera_delivered_fps",
      rates.deliveredFps === null ? null : rates.deliveredFps.toFixed(1),
    ),
    line(
      "sampled_fps",
      rates.sampledFps === null ? null : rates.sampledFps.toFixed(1),
    ),
    line(
      "delivered_frames_read_fraction",
      rates.readFraction === null ? null : rates.readFraction.toFixed(3),
    ),
  ];
}

/**
 * The frames the instrument was too busy to look at, from the
 * compositor's presentedFrames tally (roadmap 13.4, src/core/framesMissed.ts).
 *
 * This is a loss the read fraction above cannot see: when the main
 * thread is busy enough that the delivery callback itself coalesces, the
 * observer under-counts arrivals, so the fraction of arrivals it read
 * still looks whole while frames went by unlooked-at. presentedFrames is
 * the compositor's own count, not the callback's, so the gap catches it.
 *
 * Both rows are written whatever they say once a camera was observed: an
 * unknown is the honest word for a browser whose callback carries no
 * such field, or a count refused because presentedFrames did not
 * strictly advance, and a silent omission would take that limitation out
 * of the open. Null (not a summary) means no camera delivery was
 * observed at all — a clip session, or a browser with no frame callback
 * — and then no rows are written, exactly as deliveryMetadataRows stays
 * silent there.
 */
export function framesMissedMetadataRows(
  summary: FramesMissedSummary | null,
): string[] {
  if (summary === null) {
    return [];
  }
  return [
    line("frames_presented", summary.framesPresented),
    line("frames_missed_while_busy", summary.missedWhileBusy),
  ];
}

/**
 * The birth certificate of the session's ruler, in the export.
 *
 * Null when the learning window never froze: a session with no
 * certificate has nothing to describe, and the per-second baselineMm
 * column already shows that absence, so writing "unknown" rows here
 * would invite a reader to look for a calibration that never
 * happened. When the window DID freeze — into a ruler or into a
 * refusal — all four rows are written whatever they say: the
 * macbookair failure was precisely a birth whose export said nothing
 * about it, and a refused session is a result an analysis must be
 * able to count (docs/calibration-refusal.txt).
 */
export function calibrationMetadataRows(
  window: CalibrationWindow | null,
  refused: boolean,
): string[] {
  if (window === null) {
    return [];
  }
  return [
    line("calibration_samples", window.sampleCount),
    line("calibration_spread_ratio", window.spreadRatio.toFixed(3)),
    line("calibration_ceiling_bound", window.ceilingBound ? "true" : "false"),
    line("calibration_refused", refused ? "true" : "false"),
  ];
}

/** The median of a sample, or null when there is nothing to take a median of. */
export function medianIrisWidthPx(samples: readonly number[]): number | null {
  const usable = samples.filter((value) => Number.isFinite(value) && value > 0);
  return usable.length === 0 ? null : percentile(usable, 50);
}

/** The share of records that carried a usable face, 0 to 1, or null when empty. */
export function faceDetectedFraction(
  records: readonly FeatureRecord[],
): number | null {
  if (records.length === 0) {
    return null;
  }
  const seen = records.filter((record) => record.faceDetected).length;
  return seen / records.length;
}

/** Wall-clock span of the session from its own records, in seconds. */
export function observedDurationSeconds(
  records: readonly FeatureRecord[],
): number | null {
  const first = records[0];
  const last = records[records.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  const spanMs = last.timestampMs - first.timestampMs;
  return spanMs > 0 ? spanMs / 1000 : null;
}

/**
 * The conditions the session itself reveals, as opposed to the ones the
 * device declared. A camera session had none of this before.
 */
/**
 * Which loop drove the camera's measurement (roadmap 13.8b, brief
 * A2): `video-frame-callback` is once per presented frame, the
 * driver 13.8b installed; `animation-frame` is the display-paced
 * fallback kept for browsers without requestVideoFrameCallback.
 *
 * The row exists because 13.8a measured that the two drivers publish
 * DIFFERENT velocities from the same eyes — the display-paced loop
 * inflates peak closing velocity with its re-read ratio
 * (docs/inference-once.txt) — so a file that does not name its
 * driver leaves its velocity columns ambiguous.
 *
 * Absent rather than "unknown" off the camera: a clip is driven by
 * its own decoded frames by construction, so there is no camera
 * driver to name — the same absence rule the pseudonym row follows.
 */
export type CameraFrameDriver = "video-frame-callback" | "animation-frame";

export function driverMetadataRows(driver: CameraFrameDriver | null): string[] {
  return driver === null ? [] : [line("camera_frame_driver", driver)];
}

/**
 * What the screen wake lock did over a session (roadmap 13.1, brief E8;
 * decisions/ADR-0007-session-survival.md). The controller that fills
 * this touches navigator.wakeLock and so lives in io/wakeLock.ts; the
 * record shape is pure data and lives here beside the builder that
 * writes it, the same split DeviceInfo keeps from io/deviceInfo.ts.
 */
export type WakeLockOutcome = {
  /** navigator.wakeLock existed. `false` is a true statement about the
   * browser — an older iPhone Safari — never a failure. */
  supported: boolean;
  /** At least one request succeeded. */
  acquired: boolean;
  /** Successful requests AFTER the first — each one a lock the browser
   * had dropped (tab hidden) or the caller released, then re-taken. */
  reacquisitions: number;
  /** The last refusal's message, recorded rather than thrown; null when
   * nothing has been refused. */
  lastError: string | null;
};

/**
 * The wake-lock record as export rows, or nothing off a live camera.
 *
 * Null for a clip: a stepped file is driven off its own decoded frames
 * and never asks the device to stay awake, so it has no wake-lock story
 * and writes no row — the pseudonym rule, not four rows of `false`. On a
 * camera every row is written whatever it says: `wake_lock_supported:
 * false` is the fact that explains a screen that slept, and a session
 * run without the screen guarantee is precisely the one an analysis must
 * be able to find (io/wakeLock.ts records a refusal rather than throwing
 * it, for the same reason).
 *
 * `wake_lock_error` reads `none` when nothing was refused — a definite
 * statement, not `unknown` — on frame_rate_resolution_change's `none`
 * precedent; a refusal carries the browser's own message.
 */
export function wakeLockMetadataRows(
  outcome: WakeLockOutcome | null,
): string[] {
  if (outcome === null) {
    return [];
  }
  return [
    line("wake_lock_supported", outcome.supported ? "true" : "false"),
    line("wake_lock_acquired", outcome.acquired ? "true" : "false"),
    line("wake_lock_reacquisitions", outcome.reacquisitions),
    line("wake_lock_error", outcome.lastError ?? "none"),
  ];
}

/**
 * One guided calibration's span in the session clock (roadmap 11.6a):
 * from the frame the overlay opened to the frame the session resolved.
 * Named a SPAN, not a window, because `CalibrationWindow` already means
 * the baseline's learning window (calibrationWindow.ts) and one word
 * carrying two rulers is how exports get misread.
 */
export type GuidedCalibrationSpan = {
  startMs: number;
  endMs: number;
};

/**
 * The guided calibration's marker in the export, roadmap 11.6a's "with
 * a marker written". While a calibration runs, the session's four
 * reducers are fed null (main.ts, `calibrationSuppressesReducers`), so
 * without a marker that span is indistinguishable from an ordinary data
 * gap — a lost face, a covered lens. These rows say the gap was a
 * deliberate, instructed calibration and exactly where it sat, in the
 * same clock as `timestampMs` and the `marker_N_seconds` family.
 *
 * Deliberately NOT the user-placed markers stream: those marks are the
 * validation protocol's own ground truth ("ten blinks between marker 1
 * and marker 2"), and a calibration entry mixed in would corrupt it.
 *
 * Absence when no calibration ran — the pseudonym rule, not a 0 row: a
 * session that never calibrated has no suppressed span to explain.
 */
export function calibrationWindowMetadataRows(
  spans: readonly GuidedCalibrationSpan[],
): string[] {
  if (spans.length === 0) {
    return [];
  }
  const rows = [line("calibration_windows", spans.length)];
  spans.forEach((span, position) => {
    rows.push(
      line(
        `calibration_window_${position + 1}_seconds`,
        `${(span.startMs / 1000).toFixed(3)}-${(span.endMs / 1000).toFixed(3)}`,
      ),
    );
  });
  return rows;
}

export function sessionMetadataRows(
  records: readonly FeatureRecord[],
  irisWidths: readonly number[],
  markers: readonly SessionMarker[],
  // Null for a change that happened before any record existed: the
  // moment is unknown, and the export says so rather than 0.000
  // (roadmap 14.0a).
  interruptionTimesMs: readonly (number | null)[],
  measurementFrame: MeasurementFrame | null,
  poseFrames: PoseFrameCounts,
  // A session-scoped count of screen-orientation changes ("flips"),
  // counted in main.ts and passed in because the reading touches
  // `screen.orientation`. Required rather than defaulted: a session that
  // rotated must not read as 0 flips because the wiring lapsed — the
  // absent-versus-zero distinction this export keeps everywhere else.
  orientationFlips: number,
): string[] {
  const duration = observedDurationSeconds(records);
  const median = medianIrisWidthPx(irisWidths);
  const detected = faceDetectedFraction(records);
  const rows = [
    line(
      "observed_duration_seconds",
      duration === null ? null : duration.toFixed(3),
    ),
    line("records", records.length),
    // Roadmap 10.16, ladder A27. The two rules a PERCLOS value has to
    // clear before it exists, written into the file so a reader knows
    // what a blank perclos column means and what a filled one cleared.
    line("perclos_min_observed_ms", PERCLOS_MIN_OBSERVED_MS),
    line("perclos_min_samples", PERCLOS_MIN_SAMPLES),
    line(
      "face_detected_fraction",
      detected === null ? null : detected.toFixed(3),
    ),
    // The frame the MODEL read, which is not the canvas the page draws.
    // The canvas is capped at 640 wide for display and the landmarker
    // is handed the video element itself, so an iris width expressed in
    // canvas pixels understates the real resolution by exactly the
    // display scale. It said "px" without saying whose, which made the
    // one field that lets two devices be compared the field most likely
    // to mislead. Both numbers travel together now.
    line(
      "measurement_frame",
      measurementFrame === null
        ? null
        : `${measurementFrame.widthPx}x${measurementFrame.heightPx}`,
    ),
    // The measurement's own resolution, in the pixels of the frame
    // above. The iris is the ruler every millimetre on the page is
    // divided by, so how many pixels it spans sets the precision of all
    // of them. Aperture itself is a RATIO of iris pixels to lid pixels,
    // so it survives any display scale; this number does not, which is
    // why it is pinned to a stated frame.
    line("median_iris_width_px", median === null ? null : median.toFixed(1)),
    // The count row and the per-interruption timestamp rows below come
    // from the one array, so they cannot disagree — the same argument
    // that keeps the derived verdict out of the export.
    line("visibility_changes", interruptionTimesMs.length),
    // A phone that rotated mid-session says so, beside the visibility
    // count it mirrors (roadmap 13.1). A flip moves the frame the
    // measurement sits in, so a reader who finds one knows the geometry
    // changed under the session rather than staying still.
    line("orientation_flips", orientationFlips),
  ];
  if (irisWidths.length >= IRIS_SAMPLE_CAP) {
    // The blink log's WARNING precedent: a truncated record says so in
    // the file rather than looking complete.
    rows.push(
      line(
        "median_iris_width_note",
        `computed over the first ${IRIS_SAMPLE_CAP} frames, later frames not sampled`,
      ),
    );
  }
  rows.push(line("markers", markers.length));
  for (const marker of markers) {
    rows.push(
      line(`marker_${marker.index}_seconds`, (marker.atMs / 1000).toFixed(3)),
    );
  }
  // Everything from here down is the pilot's appended block
  // (docs/assessment-pilot-plan.md): new keys after the old ones, so
  // every row a reader already parses keeps its exact position.
  for (const marker of markers) {
    rows.push(
      line(
        `marker_${marker.index}_visibility_changes`,
        marker.visibilityChangesAt,
      ),
    );
  }
  // Uncapped like the markers, not capped like the frame trace: an
  // interruption is a person-scale event — a tab switch, a sleep —
  // not a per-frame stream, so a cap would be a constant chosen
  // against no benchmark.
  interruptionTimesMs.forEach((atMs, position) => {
    rows.push(
      line(
        `interruption_${position + 1}_seconds`,
        atMs === null ? null : (atMs / 1000).toFixed(3),
      ),
    );
  });
  rows.push(
    line(
      "pose_valid_fraction",
      // A gate that never ran judged nothing. Rendering that as 0.000
      // would read as "every frame failed", the exact opposite.
      poseFrames.gated === 0
        ? null
        : (poseFrames.valid / poseFrames.gated).toFixed(3),
    ),
  );
  return rows;
}

/**
 * Which code and which protocol produced this file, inside the file.
 *
 * The build already stamps its commit into a meta tag (REMEDIATION
 * E2, vite.config.ts); this is the same fact travelling in the
 * export, so a CSV separated from its page keeps its provenance. The
 * commit arrives as a parameter because reading the meta tag is the
 * page's job, and "unknown" is the honest answer when there is none.
 */
export function provenanceMetadataRows(appCommit: string | null): string[] {
  return [line("protocol", PROTOCOL_ID), line("app_commit", appCommit)];
}

/**
 * The voluntary identity row, only when one exists. Not "unknown"
 * when absent: identity here is voluntary, an unknown row would
 * imply there was something to find, and a session with no pseudonym
 * writes no row at all (docs/assessment-pilot-plan.md).
 */
export function pseudonymMetadataRows(pseudonym: string | null): string[] {
  return pseudonym === null ? [] : [line("participant_pseudonym", pseudonym)];
}

/**
 * The light-response stimulus that ran during this session, when one
 * did (docs/pupil-light-plan.md, roadmap 9.4). Only a session recorded
 * behind the stimulus screen has a schedule to describe, so a null start
 * writes no rows at all, the same reasoning as the pseudonym above.
 *
 * `startMs` is the stimulus's own moment zero in the SAME clock as the
 * `timestampMs` column, so the analysis recovers each row's phase as
 * `lightPhaseAt(row.timestampMs - startMs)`. The schedule parameters are
 * read from lightSchedule.ts rather than retyped, so the file and the
 * screen can never describe different runs.
 */
export function lightStimulusMetadataRows(startMs: number | null): string[] {
  if (startMs === null) {
    return [];
  }
  const seconds = (ms: number): number => ms / 1000;
  return [
    line(
      "light_stimulus",
      `${LIGHT_CYCLES} cycles of ${seconds(LIGHT_PHASE_MS)}s dark then ` +
        `${seconds(LIGHT_PHASE_MS)}s bright after a ${seconds(LIGHT_SETTLE_MS)}s ` +
        `settle (docs/pupil-light-plan.md)`,
    ),
    line("light_settle_ms", LIGHT_SETTLE_MS),
    line("light_phase_ms", LIGHT_PHASE_MS),
    line("light_cycles", LIGHT_CYCLES),
    line("light_stimulus_start_ms", startMs),
  ];
}

/**
 * The cued protocol's schedule, in the file it conditions (roadmap
 * 11.0b). A null start writes no rows at all — a session without the
 * protocol has no schedule to describe, the same absence rule the
 * pseudonym and the light stimulus follow — and a start of zero is a
 * start, because a protocol that began the instant the record clock
 * did began.
 *
 * The rows are the WHOLE ground truth, so an analysis scores a
 * session from its own file without this repository's code: every
 * instruction cue with its kind, start and hold (rests are the gaps
 * between them, so writing them would say nothing twice), the
 * response window the tally uses, and the time scale out loud —
 * 1.000 on every real session, smaller only on the shortened runs the
 * end-to-end Check drives, which this row makes impossible to pass
 * off as real.
 */
export function cueMetadataRows(
  startMs: number | null,
  cues: readonly Cue[],
  timeScale: number,
): string[] {
  if (startMs === null) {
    return [];
  }
  const instructions = cues.filter((cue) => cue.kind !== "rest");
  const rows = [
    line("cue_protocol_start_ms", startMs),
    line("cue_time_scale", timeScale.toFixed(3)),
    line(
      "cue_response_window_ms",
      Math.round(CUE_RESPONSE_WINDOW_MS * timeScale),
    ),
    line("cues", instructions.length),
  ];
  instructions.forEach((cue, index) => {
    rows.push(line(`cue_${index + 1}_kind`, cue.kind));
    rows.push(line(`cue_${index + 1}_seconds`, (cue.atMs / 1000).toFixed(3)));
    rows.push(line(`cue_${index + 1}_hold_ms`, Math.round(cue.holdMs)));
  });
  return rows;
}

/**
 * Whether gaze was calibrated, how well, and against what bounds
 * (roadmap 14.9a). Camera sessions only: a clip has no gaze profile
 * in force by construction, and rows there would invite a reader to
 * look for a calibration that never applied. On a camera the verdict
 * rows are written whatever they say — `false` is a fact about the
 * session — and the bounds travel with them so a reader can judge
 * the residuals without this repository's source. The residual rows
 * appear only WITH a profile, because a residual of a fit that never
 * happened is not unknown, it is nonexistent.
 */
export function gazeCalibrationMetadataRows(
  cameraSession: boolean,
  quality: ProfileQuality | null,
): string[] {
  if (!cameraSession) {
    return [];
  }
  const rows = [
    line("gaze_calibrated", quality === null ? "false" : "true"),
    line("gaze_rms_bound", GAZE_RMS_BOUND),
    line("gaze_r2_bound", GAZE_R2_BOUND),
  ];
  if (quality !== null) {
    rows.push(
      line("gaze_rms_horizontal", quality.horizontal.rmsResidual.toFixed(3)),
      line("gaze_rms_vertical", quality.vertical.rmsResidual.toFixed(3)),
      line("gaze_r2_horizontal", quality.horizontal.rSquared.toFixed(3)),
      line("gaze_r2_vertical", quality.vertical.rSquared.toFixed(3)),
    );
  }
  return rows;
}

/**
 * The buffer-overrun warning, roadmap 10.4. The per-second buffer
 * keeps FEATURE_RECORD_CAP rows — about an hour — and drops the
 * oldest silently past that, so a two-hour session exports a file
 * that looks complete while its first hour is gone. The blink log
 * already refuses to look complete when it is not (its WARNING line);
 * this is the same honesty for the per-second export: a counted row a
 * loader can read, and a sentence a person can. Absence when nothing
 * was dropped, never a zero — an under-cap session is complete, and a
 * zero row would teach readers to ignore the key.
 */
export function featureRecordOverrunRows(droppedCount: number): string[] {
  if (droppedCount <= 0) {
    return [];
  }
  return [
    line("feature_records_dropped", droppedCount),
    line(
      "feature_records_note",
      `the oldest ${String(droppedCount)} per-second rows overran the ` +
        `${String(FEATURE_RECORD_CAP)}-row buffer and are NOT in this ` +
        `file; durations and trends describe only what remains`,
    ),
  ];
}
