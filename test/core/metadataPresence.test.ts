import { describe, expect, it } from "vitest";

import { describeCalibrationWindow } from "../../src/core/calibrationWindow";
import type { DeliveryRates } from "../../src/core/deliveryRate";
import type { FeatureRecord } from "../../src/core/featureRecord";
import {
  coverageMetadataRows,
  sourceMetadataRows,
  type FrameSource,
  type MeasurementMode,
} from "../../src/core/frameClock";
import { kssMetadataRows, type KssRating } from "../../src/core/kss";
import {
  calibrationMetadataRows,
  deliveryMetadataRows,
  deviceMetadataRows,
  featureRecordOverrunRows,
  lightStimulusMetadataRows,
  provenanceMetadataRows,
  pseudonymMetadataRows,
  sessionMetadataRows,
  type DeviceInfo,
  type MeasurementFrame,
  type PoseFrameCounts,
  type SessionMarker,
} from "../../src/core/sessionMetadata";
import {
  steppingMetadataRows,
  type SteppingWitness,
} from "../../src/core/stepCalibration";
import {
  exportRowBuilders,
  specPresenceRules,
} from "../../tools/metadataKeys.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.1f3, ladder D6. WHEN each metadata key is written.
//
// 10.1f1 wrote the rules down, in SPEC.md's "when written" column, by
// reading the writers and describing them in prose. Prose beside a
// table is a claim nothing checks, and this is the check: the real row
// builders are called with the arguments three real sessions supply,
// and the keys that come out are held to the column.
//
// The distinction matters to every reader on the other side of the
// border. A key that is always written and turns up missing is a
// damaged file and should be refused. A key that is written only
// sometimes and turns up missing is an ordinary session, and refusing
// it would throw away a good measurement. A reader cannot tell those
// apart from the absence alone, so the contract has to say which the
// key is.
//
// The writers are called here rather than read as text because a
// pattern over source finds the keys a module MENTIONS, which is every
// key it can ever write, and says nothing about when. Only running
// them answers the question.

const root = repoRoot();

/** The device rows a real camera session carries. */
const CAMERA: DeviceInfo = {
  cameraLabel: "Fixture Cam",
  cameraWidthPx: 1280,
  cameraHeightPx: 720,
  cameraDeclaredFps: 60,
  facingMode: "user",
  userAgent: "Mozilla/5.0 (Macintosh)",
  hardwareConcurrency: 8,
  viewportWidthPx: 1200,
  viewportHeightPx: 800,
  screenWidthPx: 1512,
  screenHeightPx: 982,
  devicePixelRatio: 2,
  orientation: "landscape-primary",
};

function record(timestampMs: number): FeatureRecord {
  return {
    timestampMs,
    faceDetected: true,
    fps: 60,
    apertureMm: 7,
    baselineMm: 7,
    shutBaselineMm: null,
    baselineOverResting: null,
    blinkRatePerMin: null,
    lastBlinkDurationMs: null,
    lastBlinkAmplitudeMm: null,
    lastBlinkPeakVelocityMmPerS: null,
    perclos: null,
    longClosureCount: 0,
    fixationCount: 0,
    fixationMedianMs: null,
    fixating: false,
    onScreen: null,
    pupilDiameterMm: null,
  };
}

/**
 * Everything `exportSession` hands its row builders, for one session.
 *
 * Named for the session it describes rather than for the arguments,
 * because the question this file answers is which SESSIONS carry which
 * keys.
 */
type Shape = {
  source: FrameSource;
  clipName: string | null;
  mode: MeasurementMode;
  framesMeasured: number;
  clipDurationSeconds: number | null;
  stepping: SteppingWitness | null;
  device: DeviceInfo | null;
  calibrationSamples: readonly number[];
  calibrationRefused: boolean;
  delivery: DeliveryRates | null;
  records: readonly FeatureRecord[];
  irisWidths: readonly number[];
  markers: readonly SessionMarker[];
  interruptionTimesMs: readonly (number | null)[];
  measurementFrame: MeasurementFrame | null;
  poseFrames: PoseFrameCounts;
  recordsDropped: number;
  kssBefore: KssRating | null;
  kssAfter: KssRating | null;
  kssAfterAtMs: number | null;
  appCommit: string | null;
  pseudonym: string | null;
  lightStimulusStartMs: number | null;
};

/**
 * A live camera session where nothing optional happened.
 *
 * Somebody opened the page, let it run, and exported. No baseline ever
 * froze, no marks were placed, the tab was never left, no pseudonym was
 * set, no light stimulus ran, the buffer never overran and the KSS
 * question was never put. This is the floor: whatever a file this thin
 * still carries is a row every camera export has.
 */
const MINIMAL_CAMERA: Shape = {
  source: "camera",
  clipName: null,
  mode: "live",
  framesMeasured: 0,
  clipDurationSeconds: null,
  stepping: null,
  device: CAMERA,
  calibrationSamples: [],
  calibrationRefused: false,
  delivery: null,
  records: [],
  irisWidths: [],
  markers: [],
  interruptionTimesMs: [],
  measurementFrame: null,
  poseFrames: { gated: 0, valid: 0 },
  recordsDropped: 0,
  kssBefore: null,
  kssAfter: null,
  kssAfterAtMs: null,
  appCommit: null,
  pseudonym: null,
  lightStimulusStartMs: null,
};

/**
 * A clip stepped from a file, which has no camera and no room.
 *
 * `deviceMetadataRows` answers a null device with one row saying so,
 * and that one row is the whole of what a clip knows about hardware.
 */
const MINIMAL_CLIP: Shape = {
  ...MINIMAL_CAMERA,
  source: "file",
  clipName: "corpus/06-5.mp4",
  mode: "stepped",
  device: null,
};

/** A session where every optional thing happened at least once. */
const FULL: Shape = {
  source: "camera",
  clipName: null,
  mode: "live",
  framesMeasured: 3600,
  clipDurationSeconds: 60,
  stepping: {
    frameIntervalSeconds: 1 / 30,
    framesSought: 1800,
    inexactLandings: 2,
  },
  device: CAMERA,
  calibrationSamples: Array.from({ length: 301 }, () => 7),
  calibrationRefused: false,
  delivery: { deliveredFps: 60, sampledFps: 59.9, readFraction: 0.998 },
  records: [record(0), record(1000)],
  irisWidths: Array.from({ length: 2000 }, () => 30),
  markers: [
    { atMs: 42_000, index: 1, visibilityChangesAt: 0 },
    { atMs: 55_500, index: 2, visibilityChangesAt: 1 },
  ],
  interruptionTimesMs: [12_000],
  measurementFrame: { widthPx: 1280, heightPx: 720 },
  poseFrames: { gated: 100, valid: 98 },
  recordsDropped: 12,
  kssBefore: 3,
  kssAfter: 4,
  kssAfterAtMs: 61_000,
  appCommit: "abc1234",
  pseudonym: "participant-01",
  lightStimulusStartMs: 5000,
};

/**
 * The metadata block one session exports, assembled the way the page
 * assembles it.
 */
function metadataRows(shape: Shape): string[] {
  return [
    ...sourceMetadataRows(shape.source, shape.clipName),
    ...coverageMetadataRows(
      shape.mode,
      shape.framesMeasured,
      shape.clipDurationSeconds,
    ),
    ...steppingMetadataRows(shape.stepping),
    ...deviceMetadataRows(shape.device),
    ...calibrationMetadataRows(
      describeCalibrationWindow(shape.calibrationSamples),
      shape.calibrationRefused,
    ),
    ...deliveryMetadataRows(shape.delivery),
    ...sessionMetadataRows(
      shape.records,
      shape.irisWidths,
      shape.markers,
      shape.interruptionTimesMs,
      shape.measurementFrame,
      shape.poseFrames,
    ),
    ...featureRecordOverrunRows(shape.recordsDropped),
    ...kssMetadataRows(shape.kssBefore, shape.kssAfter, shape.kssAfterAtMs),
    ...provenanceMetadataRows(shape.appCommit),
    ...pseudonymMetadataRows(shape.pseudonym),
    ...lightStimulusMetadataRows(shape.lightStimulusStartMs),
  ];
}

/** The row builders this file calls, in the order it calls them. */
const CALLED_HERE = [
  "sourceMetadataRows",
  "coverageMetadataRows",
  "steppingMetadataRows",
  "deviceMetadataRows",
  "calibrationMetadataRows",
  "deliveryMetadataRows",
  "sessionMetadataRows",
  "featureRecordOverrunRows",
  "kssMetadataRows",
  "provenanceMetadataRows",
  "pseudonymMetadataRows",
  "lightStimulusMetadataRows",
];

function keysOf(shape: Shape): Set<string> {
  const keys = new Set<string>();
  for (const row of metadataRows(shape)) {
    const key = /^# ([a-z_0-9]+):/.exec(row)?.[1];
    if (key === undefined) {
      // Refusing rather than skipping: a row this cannot read is a row
      // absent from every set below, and a key silently missing from
      // the classification is the failure this file exists to catch.
      throw new Error(`not a metadata row: ${row}`);
    }
    // A per-index family is one rule, not one rule per marker.
    keys.add(key.replace(/_\d+_/, "_N_"));
  }
  return keys;
}

const minimalCamera = keysOf(MINIMAL_CAMERA);
const minimalClip = keysOf(MINIMAL_CLIP);
const full = keysOf(FULL);

/** Written by the thinnest session of either kind. */
const always = [...full]
  .filter((key) => minimalCamera.has(key) && minimalClip.has(key))
  .sort();

/** Written by a camera session however thin, and by no clip. */
const cameraOnly = [...full]
  .filter((key) => minimalCamera.has(key) && !minimalClip.has(key))
  .sort();

/** Written only when the thing it describes happened. */
const conditional = [...full]
  .filter((key) => !minimalCamera.has(key) || !minimalClip.has(key))
  .filter((key) => !cameraOnly.includes(key))
  .sort();

describe("the exercise reaches the real export", () => {
  it("calls the row builders the page calls, in the page's order", () => {
    // Without this the presence rules describe a block this file
    // invented. A builder added to the export and not to the list
    // above would leave its keys unclassified and every assertion
    // below still passing.
    expect(CALLED_HERE).toEqual(exportRowBuilders(root));
  });

  it("assembles a block with a useful number of keys in it", () => {
    // The floor. A `metadataRows` that returned nothing would make
    // every set below empty and every comparison a comparison of two
    // empty lists.
    expect(full.size).toBeGreaterThan(40);
    expect(minimalCamera.size).toBeGreaterThan(20);
  });

  it("writes more for a full session than for a thin one", () => {
    expect(full.size).toBeGreaterThan(minimalCamera.size);
    expect(minimalCamera.size).toBeGreaterThan(minimalClip.size);
  });
});

describe("every key is one of the three kinds", () => {
  it("classifies each key the export can write exactly once", () => {
    expect([...always, ...cameraOnly, ...conditional].sort()).toEqual(
      [...full].sort(),
    );
    expect(always.length + cameraOnly.length + conditional.length).toBe(
      full.size,
    );
  });

  it("puts the rows a reader may always demand in the first kind", () => {
    // Named individually because these are the keys a loader is
    // entitled to refuse a file for missing. Anything that leaves this
    // list has stopped being a promise the export keeps.
    for (const key of [
      "source",
      "measurement_mode",
      "frames_measured",
      "records",
      "markers",
      "visibility_changes",
      "pose_valid_fraction",
      "protocol",
      "app_commit",
      "kss_before",
      "kss_after",
    ]) {
      expect(always, `${key} is written by every export`).toContain(key);
    }
  });

  it("keeps the sometimes-written rows out of it", () => {
    // Each of these is absent from an ordinary healthy session, so a
    // reader that refused a file for missing one would refuse good
    // measurements.
    for (const key of [
      "calibration_samples",
      "sampled_fps",
      "marker_N_seconds",
      "participant_pseudonym",
      "light_stimulus_start_ms",
      "feature_records_dropped",
      "median_iris_width_note",
      "frames_sought",
    ]) {
      expect(always, `${key} is not written by every export`).not.toContain(
        key,
      );
    }
  });
});

describe("SPEC.md's when-written column says what the writers do", () => {
  const rules = specPresenceRules(root);

  it("has a rule for every key the export writes", () => {
    const missing = [...full].filter((key) => !(key in rules)).sort();
    expect(missing, `no when-written rule: ${missing.join(", ")}`).toEqual([]);
  });

  it("says Every export for exactly the always-written keys", () => {
    const claimed = Object.keys(rules)
      .filter((key) => rules[key] === "Every export")
      .filter((key) => full.has(key))
      .sort();
    expect(claimed).toEqual(always);
  });

  it("says Camera sessions for exactly the camera-only keys", () => {
    const claimed = Object.keys(rules)
      .filter((key) => rules[key] === "Camera sessions")
      .filter((key) => full.has(key))
      .sort();
    expect(claimed).toEqual(cameraOnly);
  });

  it("gives every conditional key a rule that is not Every export", () => {
    // The one that matters on the reading side: a key described as
    // unconditional that a healthy session omits invites a loader to
    // refuse good files.
    const overclaimed = conditional
      .filter((key) => rules[key] === "Every export")
      .sort();
    expect(
      overclaimed,
      `claimed unconditional and not always written: ${overclaimed.join(", ")}`,
    ).toEqual([]);
  });
});
