import type { CalibrationWindow } from "../../src/core/calibrationWindow";
import { serializeRecords } from "../../src/core/csv";
import type { DeliveryRates } from "../../src/core/deliveryRate";
import type { FeatureRecord } from "../../src/core/featureRecord";
import {
  coverageMetadataRows,
  sourceMetadataRows,
} from "../../src/core/frameClock";
import { kssMetadataRows, type KssRating } from "../../src/core/kss";
import { asExported } from "../../src/core/participantReport";
import {
  initialRulerFitState,
  rulerFitStep,
  type RulerFitVerdict,
} from "../../src/core/rulerFit";
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
import type { VerdictInputs } from "../../src/core/sessionVerdict";
import { steppingMetadataRows } from "../../src/core/stepCalibration";

// Roadmap 10.1f5, ladder D6. ONE description per fixture session, and
// both sides of the verdict pin derived from it.
//
// The pin itself is older: a synthetic session CSV beside a canonical
// verdict JSON, and both implementations must reproduce the JSON — the
// page from page state, the Python mirror from the CSV alone — so a
// mutation on either side lands on the same committed bytes.
//
// What the pin did not have was one source. The CSVs were typed by
// hand and the page-state literals beside them were typed by hand
// again, which is two descriptions of one session maintained in step
// by attention. They had already drifted: every fixture carried
// `# kss_before: 3` where `kss.ts` can write only `3 (Alert)` or
// `skipped`, so the file the two implementations agreed about was a
// file the exporter could not have written (audit G-export/l-9). And
// because nothing in the loop imported `sessionMetadata.ts`, a renamed
// metadata key broke no test here at all.
//
// So the fixtures are built from the same twelve row builders the page
// calls at export, and the page-state inputs are derived from the same
// object rather than restated. The ruler-fit verdict is not written
// down anywhere: it is replayed through the real `rulerFitStep` over
// the same records the CSV carries, exactly as `main.ts` does.

/** One synthetic session, described once. */
export type FixtureSession = {
  /** The fixture's name on disk: `<name>-session.csv`. */
  name: string;
  device: DeviceInfo;
  delivery: DeliveryRates;
  /** The rate the records carry, and the verdict's fallback evidence. */
  processingFps: number;
  /** Every record's aperture: the ruler-fit replay reads these. */
  apertureMm: number;
  /** The learning window that froze, or null where none did. */
  calibration: CalibrationWindow | null;
  calibrationRefused: boolean;
  recordTimesMs: number[];
  markers: SessionMarker[];
  interruptionTimesMs: (number | null)[];
  measurementFrame: MeasurementFrame;
  poseFrames: PoseFrameCounts;
  irisWidths: number[];
  kssBefore: KssRating | null;
  kssAfter: KssRating | null;
  /** Stamped `dev`, as a build from a working tree writes it. */
  appCommit: string;
};

/**
 * The baseline the page would be measuring with, or null.
 *
 * A refused calibration has no ruler, so the records carry no
 * baseline, the fit check never settles, and the exported column is
 * empty. One expression, so the CSV and the verdict cannot disagree
 * about it.
 */
function readyBaselineMm(session: FixtureSession): number | null {
  if (session.calibration === null || session.calibrationRefused) {
    return null;
  }
  return session.calibration.baselineMm;
}

/** The per-second rows this session exports. */
export function fixtureRecords(session: FixtureSession): FeatureRecord[] {
  const baselineMm = readyBaselineMm(session);
  return session.recordTimesMs.map((timestampMs) => ({
    timestampMs,
    faceDetected: true,
    fps: session.processingFps,
    apertureMm: session.apertureMm,
    baselineMm,
    shutBaselineMm: null,
    baselineOverResting:
      baselineMm === null ? null : baselineMm / session.apertureMm,
    blinkRatePerMin: null,
    lastBlinkDurationMs: null,
    lastBlinkAmplitudeMm: null,
    lastBlinkPeakVelocityMmPerS: null,
    perclos: null,
    longClosureCount: 0,
    fixationCount: 0,
    fixationMedianMs: null,
    fixating: false,
    onScreen: true,
    pupilDiameterMm: null,
  }));
}

/** The row builders this file calls, in the order it calls them. */
export const FIXTURE_ROW_BUILDERS = [
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

/**
 * The whole export, assembled the way `exportSession` assembles it.
 *
 * Every builder is called, including the ones this session gives
 * nothing to: a builder that writes no row for a null input is part of
 * the contract, and skipping it here would let the order drift out of
 * step with the page unnoticed.
 */
export function fixtureCsv(session: FixtureSession): string {
  const records = fixtureRecords(session);
  const csv = serializeRecords(records, [
    ...sourceMetadataRows("camera", null),
    ...coverageMetadataRows("live", records.length, null),
    ...steppingMetadataRows(null),
    ...deviceMetadataRows(session.device),
    ...calibrationMetadataRows(session.calibration, session.calibrationRefused),
    ...deliveryMetadataRows(session.delivery),
    ...sessionMetadataRows(
      records,
      session.irisWidths,
      session.markers,
      session.interruptionTimesMs,
      session.measurementFrame,
      session.poseFrames,
    ),
    ...featureRecordOverrunRows(0),
    ...kssMetadataRows(session.kssBefore, session.kssAfter, null),
    ...provenanceMetadataRows(session.appCommit),
    ...pseudonymMetadataRows(null),
    ...lightStimulusMetadataRows(null),
  ]);
  if (csv === null) {
    throw new Error(`${session.name}: the fixture holds no records`);
  }
  return csv;
}

/**
 * What the page would hand its verdict for this session.
 *
 * Derived, never restated. The rate goes through `asExported` because
 * that is what `participantVerdictInputs` does, so the page and the
 * file compute from one number at a rounding boundary. The ruler fit
 * is replayed through the real accumulator over the real records.
 */
export function fixtureVerdictInputs(session: FixtureSession): VerdictInputs {
  const baselineMm = readyBaselineMm(session);
  let fit = initialRulerFitState;
  for (const record of fixtureRecords(session)) {
    fit = rulerFitStep(fit, record.apertureMm, baselineMm);
  }
  return {
    calibration: calibrationState(session),
    // Structural: a file with rows exists only because a session ran
    // to an export, so both of these read from the file's existence.
    cameraOutcome: { kind: "running" },
    modelTrusted: true,
    sampledFps:
      session.delivery.sampledFps === null
        ? null
        : asExported(session.delivery.sampledFps, 1),
    processingFps: session.processingFps,
    visibilityChanges: session.interruptionTimesMs.length,
    markedWindow: markedWindow(session),
    poseValidFraction:
      session.poseFrames.gated === 0
        ? null
        : session.poseFrames.valid / session.poseFrames.gated,
    rulerFitShown: fit.shown as RulerFitVerdict | null,
  };
}

function calibrationState(
  session: FixtureSession,
): VerdictInputs["calibration"] {
  if (session.calibration === null) {
    // No window froze, so the page is still learning. No fixture takes
    // this branch today; it is here because the type has it and a
    // fixture that added it must not have to invent the shape.
    return { kind: "learning", startedAtMs: 0, samples: [] };
  }
  if (session.calibrationRefused) {
    return { kind: "refused", window: session.calibration };
  }
  return {
    kind: "ready",
    baselineMm: session.calibration.baselineMm,
    window: session.calibration,
  };
}

function markedWindow(session: FixtureSession): VerdictInputs["markedWindow"] {
  const [first, second] = session.markers;
  if (first === undefined || second === undefined) {
    return null;
  }
  return {
    widthSeconds: (second.atMs - first.atMs) / 1000,
    interruptionsInside: second.visibilityChangesAt - first.visibilityChangesAt,
  };
}

const CAMERA: DeviceInfo = {
  cameraLabel: "Fixture Cam",
  cameraWidthPx: 1280,
  cameraHeightPx: 720,
  cameraDeclaredFps: 60,
  facingMode: "user",
  // A real string, so the fixture exercises the reduction the
  // exporter applies rather than its give-up branch.
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  hardwareConcurrency: 8,
  viewportWidthPx: 1200,
  viewportHeightPx: 800,
  screenWidthPx: 1512,
  screenHeightPx: 982,
  devicePixelRatio: 2,
  orientation: "landscape-primary",
};

const READY_WINDOW: CalibrationWindow = {
  sampleCount: 301,
  medianMm: 7,
  p90Mm: 7.9,
  spreadRatio: 1.129,
  ceilingBound: false,
  baselineMm: 7.9,
};

/** A session that went well: the shape every other fixture varies from. */
const GOOD: FixtureSession = {
  name: "good",
  device: CAMERA,
  delivery: { deliveredFps: 60, sampledFps: 60, readFraction: 1 },
  processingFps: 60,
  apertureMm: 7,
  calibration: READY_WINDOW,
  calibrationRefused: false,
  recordTimesMs: [1000, 42_000, 55_500, 60_000],
  markers: [
    { atMs: 42_000, index: 1, visibilityChangesAt: 0 },
    { atMs: 55_500, index: 2, visibilityChangesAt: 0 },
  ],
  interruptionTimesMs: [],
  measurementFrame: { widthPx: 1280, heightPx: 720 },
  poseFrames: { gated: 1000, valid: 980 },
  irisWidths: [30],
  kssBefore: 3,
  kssAfter: 4,
  appCommit: "dev",
};

export const FIXTURES: FixtureSession[] = [
  GOOD,
  {
    // The calibration that refused. No ruler was born, so the baseline
    // column is empty, the fit check never settles, and the report
    // withholds every number that depends on the blink line.
    ...GOOD,
    name: "refused",
    calibration: {
      sampleCount: 301,
      medianMm: 7,
      p90Mm: 9.65,
      spreadRatio: 1.378,
      ceilingBound: true,
      baselineMm: 9.65,
    },
    calibrationRefused: true,
  },
  {
    // Safari's shape: the browser reports no frame delivery, so the
    // evidence rate falls back to the processing rate and says whose
    // rate it is. Two interruptions, both before the first mark, so the
    // window itself is undisturbed while the session is not.
    ...GOOD,
    name: "degraded",
    delivery: { deliveredFps: null, sampledFps: null, readFraction: null },
    processingFps: 30,
    calibration: {
      sampleCount: 301,
      medianMm: 7,
      p90Mm: 9,
      spreadRatio: 1.18,
      ceilingBound: false,
      baselineMm: 9,
    },
    interruptionTimesMs: [12_000, 20_000],
    markers: [
      { atMs: 42_000, index: 1, visibilityChangesAt: 2 },
      { atMs: 55_500, index: 2, visibilityChangesAt: 2 },
    ],
    poseFrames: { gated: 1000, valid: 620 },
  },
  {
    // The other rounding boundary, roadmap 10.1f6. The refusal floor
    // below has been pinned since 10.15; the risk threshold at 60 had
    // not been, and it is the same defect one step up. A measured
    // 59.96 reaches the file as 60.0, which reads "above the 60 risk
    // band"; the raw double reads "quick or shallow blinks can be
    // missed below 60". Two different sentences about one session,
    // and the pilot halts a cohort on that disagreement.
    ...GOOD,
    name: "risk-edge",
    delivery: { deliveredFps: 60, sampledFps: 59.96, readFraction: 0.999 },
  },
  {
    // The rounding boundary, roadmap 10.15 (audit G-export/l-1). A
    // measured 24.96 reaches the file as 25.0, and the page must hand
    // its verdict the same 25.0 rather than the raw double, or the two
    // implementations disagree across the refusal floor and the pilot
    // stops the cohort calling it an instrument defect.
    ...GOOD,
    name: "edge",
    delivery: { deliveredFps: 60, sampledFps: 24.96, readFraction: 0.416 },
  },
];
