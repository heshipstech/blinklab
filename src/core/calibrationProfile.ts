import type { CompletedTarget } from "./calibrationCapture";
import type { IrisOffset } from "./gazeOffset";
import type { ScreenQuadrant } from "./gazeQuadrant";
import { percentile } from "./statistics";

// The solver half of calibration: 5.4a collected labelled pairs, this
// turns them into a personal profile. Each dot's stay is summarized
// by its MEDIAN offset, the robust middle a stray blink cannot drag,
// then one least squares line per axis maps offsets to screen
// fractions. Four numbers total, and the mirror flip between image
// space and the user's screen arrives as a learned negative slope,
// not a hand-written sign.
export type AxisMap = {
  slope: number;
  intercept: number;
};

export type CalibrationProfile = {
  horizontal: AxisMap;
  vertical: AxisMap;
};

// A screen position in viewport fractions, 0,0 top left, 1,1 bottom
// right, the same space the calibration targets live in. Unlike the
// offset space, this one already IS the user's perspective.
export type ScreenPoint = {
  x: number;
  y: number;
};

type AxisPair = {
  offset: number;
  screen: number;
};

// Roadmap 14.9a's refusal bounds, PRE-STATED: these two numbers were
// written into the roadmap row before any owner capture was read for
// the question, so nothing here was fitted to an answer. RMS residual
// is in screen fractions — 0.15 is about a seventh of the screen, the
// point past which "which quadrant" answers start crossing the centre
// lines — and R² below 0.8 means a fifth of the targets' variance
// never made it into the fit. AT the bound still passes, the house
// boundary rule; strictly past it refuses.
export const GAZE_RMS_BOUND = 0.15;
export const GAZE_R2_BOUND = 0.8;

/** How far the head may drift before the calibrated point nulls:
 * about five degrees of pitch or yaw, or a tenth of the iris width —
 * the working-distance proxy, since the iris ruler moves one-for-one
 * with distance. Both stated as choices; 14.9b re-reads them from a
 * measured error file. */
export const GAZE_POSE_DRIFT_DEG = 5;
export const GAZE_IRIS_DRIFT_FRACTION = 0.1;

export type AxisQuality = {
  /** Root mean square residual, in screen fractions. */
  rmsResidual: number;
  rSquared: number;
};

export type ProfileQuality = {
  horizontal: AxisQuality;
  vertical: AxisQuality;
};

/**
 * The room the profile was learned in. A mapping from iris offsets to
 * screen fractions is a claim about ONE camera looking at one face in
 * one window; carried with the profile, these let a later load refuse
 * a different room instead of quietly misclassifying in it. Null
 * means not measured, and an unknown can never convict.
 */
export type ProfileConditions = {
  pitchDeg: number | null;
  yawDeg: number | null;
  irisWidthPx: number | null;
  viewportWidthPx: number;
  viewportHeightPx: number;
  devicePixelRatio: number;
  screenWidthPx: number | null;
  screenHeightPx: number | null;
  cameraLabel: string | null;
};

/** What the store holds since 14.9a: the map, how well it fit, and
 * the room it was measured in. */
export type StoredGazeProfile = {
  horizontal: AxisMap;
  vertical: AxisMap;
  quality: ProfileQuality;
  conditions: ProfileConditions;
};

function fitLine(pairs: readonly AxisPair[]): AxisMap | null {
  if (pairs.length < 2) {
    return null;
  }
  let meanOffset = 0;
  let meanScreen = 0;
  for (const pair of pairs) {
    meanOffset += pair.offset / pairs.length;
    meanScreen += pair.screen / pairs.length;
  }
  let cross = 0;
  let spread = 0;
  for (const pair of pairs) {
    cross += (pair.offset - meanOffset) * (pair.screen - meanScreen);
    spread += (pair.offset - meanOffset) * (pair.offset - meanOffset);
  }
  // A frozen axis has no spread, and a line fit to it would divide
  // by zero. An iris that never moved teaches nothing, refuse it.
  if (spread <= 0) {
    return null;
  }
  const slope = cross / spread;
  return { slope, intercept: meanScreen - slope * meanOffset };
}

/** One axis's fit and its quality, or null where no line exists. */
function fitAxis(
  pairs: readonly AxisPair[],
): { map: AxisMap; quality: AxisQuality } | null {
  const map = fitLine(pairs);
  if (map === null) {
    return null;
  }
  let meanScreen = 0;
  for (const pair of pairs) {
    meanScreen += pair.screen / pairs.length;
  }
  let residualSq = 0;
  let totalSq = 0;
  for (const pair of pairs) {
    const predicted = map.slope * pair.offset + map.intercept;
    residualSq += (pair.screen - predicted) * (pair.screen - predicted);
    totalSq += (pair.screen - meanScreen) * (pair.screen - meanScreen);
  }
  if (totalSq <= 0) {
    // Every target on this axis sat at the same screen coordinate, so
    // there is no variance to explain and R² is not a number. The
    // nine-dot grid cannot produce this; a capture that did teaches
    // nothing and reads as no line.
    return null;
  }
  return {
    map,
    quality: {
      rmsResidual: Math.sqrt(residualSq / pairs.length),
      rSquared: 1 - residualSq / totalSq,
    },
  };
}

export type SolveOutcome =
  | { kind: "solved"; profile: CalibrationProfile; quality: ProfileQuality }
  | {
      kind: "refused";
      axis: "horizontal" | "vertical";
      rmsResidual: number;
      rSquared: number;
    }
  | { kind: "unsolvable" };

/**
 * The solve with its verdict (roadmap 14.9a). "unsolvable" is the old
 * null — too few dots, a frozen axis — where no line exists at all;
 * "refused" is new and different: a line EXISTS and fits worse than
 * the pre-stated bounds, which before this row shipped as a
 * calibration. The noise-only axis is exactly that case: least
 * squares happily draws a line through noise, and only the quality
 * says so.
 */
export function solveCalibrationOutcome(
  completed: readonly CompletedTarget[],
): SolveOutcome {
  const medians = targetMedians(completed);
  const horizontal = fitAxis(
    medians.map((m) => ({ offset: m.median.horizontal, screen: m.target.x })),
  );
  const vertical = fitAxis(
    medians.map((m) => ({ offset: m.median.vertical, screen: m.target.y })),
  );
  if (horizontal === null || vertical === null) {
    return { kind: "unsolvable" };
  }
  for (const [axis, fitted] of [
    ["horizontal", horizontal],
    ["vertical", vertical],
  ] as const) {
    if (
      fitted.quality.rmsResidual > GAZE_RMS_BOUND ||
      fitted.quality.rSquared < GAZE_R2_BOUND
    ) {
      return {
        kind: "refused",
        axis,
        rmsResidual: fitted.quality.rmsResidual,
        rSquared: fitted.quality.rSquared,
      };
    }
  }
  return {
    kind: "solved",
    profile: { horizontal: horizontal.map, vertical: vertical.map },
    quality: { horizontal: horizontal.quality, vertical: vertical.quality },
  };
}

function targetMedians(completed: readonly CompletedTarget[]): {
  median: IrisOffset;
  target: CompletedTarget["target"];
}[] {
  const medians: { median: IrisOffset; target: CompletedTarget["target"] }[] =
    [];
  for (const { target, samples } of completed) {
    const horizontal = percentile(
      samples.map((s) => s.horizontal),
      50,
    );
    const vertical = percentile(
      samples.map((s) => s.vertical),
      50,
    );
    // A dot that collected nothing has no median and no vote.
    if (horizontal === null || vertical === null) {
      continue;
    }
    medians.push({ median: { horizontal, vertical }, target });
  }
  return medians;
}

/**
 * The map alone, kept for the callers that only classify. A profile
 * that could answer only one axis would misclassify the other with
 * confidence, so it is all or nothing — and since 14.9a a fit past
 * the pre-stated bounds is nothing too.
 */
export function solveCalibration(
  completed: readonly CompletedTarget[],
): CalibrationProfile | null {
  const outcome = solveCalibrationOutcome(completed);
  return outcome.kind === "solved" ? outcome.profile : null;
}

export function calibratedPoint(
  profile: CalibrationProfile,
  offset: IrisOffset,
): ScreenPoint {
  return {
    x:
      profile.horizontal.slope * offset.horizontal +
      profile.horizontal.intercept,
    y: profile.vertical.slope * offset.vertical + profile.vertical.intercept,
  };
}

// Viewport fractions read in the user's own language: smaller x is
// the user's left, smaller y is the top. Boundary convention:
// exactly the centre counts as top and as left.
export function calibratedQuadrant(point: ScreenPoint): ScreenQuadrant {
  const side = point.x <= 0.5 ? "left" : "right";
  const band = point.y <= 0.5 ? "top" : "bottom";
  return `${band} ${side}` as ScreenQuadrant;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseAxisMap(value: unknown): AxisMap | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!finiteNumber(record.slope) || !finiteNumber(record.intercept)) {
    return null;
  }
  return { slope: record.slope, intercept: record.intercept };
}

/**
 * Parse a stored gaze profile, or null for anything that is not one.
 *
 * The gaze store used to read its profile with `JSON.parse(raw) as
 * CalibrationProfile` and trust whatever came back, so a value that
 * parsed but had the wrong shape — a missing axis, a slope that was a
 * string — became a mapping that returned NaN for every gaze point.
 * This is the validated boundary that replaces the cast, the same
 * stance parseBlinkCalibration takes on the blink line.
 *
 * Positivity is deliberately NOT required: a slope is negative for the
 * image-to-screen mirror flip (solveCalibration learns it as one), and
 * an intercept can be either sign, so the check is shape and finiteness
 * only. A four-number profile whose numbers are all finite is one this
 * solver could have produced; anything else is a stale-format or
 * tampered entry and reads as no profile, which the page already shows
 * honestly as uncalibrated.
 */
export function parseCalibrationProfile(
  raw: string,
): CalibrationProfile | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const horizontal = parseAxisMap(record.horizontal);
  const vertical = parseAxisMap(record.vertical);
  if (horizontal === null || vertical === null) {
    return null;
  }
  return { horizontal, vertical };
}

function finiteOrNull(value: unknown): number | null {
  return finiteNumber(value) ? value : null;
}

function parseConditions(value: unknown): ProfileConditions | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !finiteNumber(record.viewportWidthPx) ||
    !finiteNumber(record.viewportHeightPx) ||
    !finiteNumber(record.devicePixelRatio)
  ) {
    // The window is the one condition every browser can report, so a
    // conditions block without it is not a conditions block.
    return null;
  }
  return {
    pitchDeg: finiteOrNull(record.pitchDeg),
    yawDeg: finiteOrNull(record.yawDeg),
    irisWidthPx: finiteOrNull(record.irisWidthPx),
    viewportWidthPx: record.viewportWidthPx,
    viewportHeightPx: record.viewportHeightPx,
    devicePixelRatio: record.devicePixelRatio,
    screenWidthPx: finiteOrNull(record.screenWidthPx),
    screenHeightPx: finiteOrNull(record.screenHeightPx),
    cameraLabel:
      typeof record.cameraLabel === "string" ? record.cameraLabel : null,
  };
}

function parseAxisQuality(value: unknown): AxisQuality | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!finiteNumber(record.rmsResidual) || !finiteNumber(record.rSquared)) {
    return null;
  }
  return { rmsResidual: record.rmsResidual, rSquared: record.rSquared };
}

export function serializeGazeProfile(profile: StoredGazeProfile): string {
  return JSON.stringify(profile);
}

/**
 * The stored profile since 14.9a, or null for anything that is not
 * one. A v1 profile — the bare four numbers — parses as null on
 * purpose: it carries no quality and no conditions, so nothing about
 * it can be checked, and an uncheckable calibration is the thing this
 * row exists to retire. The page then shows uncalibrated, the same
 * stance every stale format here gets.
 */
export function parseStoredGazeProfile(raw: string): StoredGazeProfile | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const horizontal = parseAxisMap(record.horizontal);
  const vertical = parseAxisMap(record.vertical);
  if (horizontal === null || vertical === null) {
    return null;
  }
  const quality = record.quality as Record<string, unknown> | undefined;
  const horizontalQuality = parseAxisQuality(quality?.horizontal);
  const verticalQuality = parseAxisQuality(quality?.vertical);
  const conditions = parseConditions(record.conditions);
  if (
    horizontalQuality === null ||
    verticalQuality === null ||
    conditions === null
  ) {
    return null;
  }
  return {
    horizontal,
    vertical,
    quality: { horizontal: horizontalQuality, vertical: verticalQuality },
    conditions,
  };
}

/** What the loading page can read about its own room right now. */
export type CurrentConditions = {
  viewportWidthPx: number;
  viewportHeightPx: number;
  devicePixelRatio: number;
  screenWidthPx: number | null;
  screenHeightPx: number | null;
  cameraLabel: string | null;
};

/**
 * Whether a stored profile may be used in this room (roadmap 14.9a's
 * "a pinned profile with a stale window refuses on load"). A KNOWN
 * difference in the window, the pixel ratio, the screen or the camera
 * refuses, because the mapping was learned in geometry this room does
 * not have; an unknown on either side can never convict, the null
 * rule. Pose and iris drift are the LIVE check's business
 * (headMovedSinceCalibration below), not load's: a head position is a
 * moment, not a room.
 */
export function profileLoadVerdict(
  stored: StoredGazeProfile,
  current: CurrentConditions,
): { kind: "ok" } | { kind: "refused"; why: string } {
  const c = stored.conditions;
  if (
    c.viewportWidthPx !== current.viewportWidthPx ||
    c.viewportHeightPx !== current.viewportHeightPx
  ) {
    return {
      kind: "refused",
      why:
        `calibrated in a ${String(c.viewportWidthPx)}x` +
        `${String(c.viewportHeightPx)} window, and this window is ` +
        `${String(current.viewportWidthPx)}x` +
        `${String(current.viewportHeightPx)}`,
    };
  }
  if (c.devicePixelRatio !== current.devicePixelRatio) {
    return {
      kind: "refused",
      why: "calibrated at a different device pixel ratio for this window",
    };
  }
  if (
    c.screenWidthPx !== null &&
    current.screenWidthPx !== null &&
    c.screenHeightPx !== null &&
    current.screenHeightPx !== null &&
    (c.screenWidthPx !== current.screenWidthPx ||
      c.screenHeightPx !== current.screenHeightPx)
  ) {
    return { kind: "refused", why: "calibrated on a different screen" };
  }
  if (
    c.cameraLabel !== null &&
    current.cameraLabel !== null &&
    c.cameraLabel !== current.cameraLabel
  ) {
    return { kind: "refused", why: "calibrated through a different camera" };
  }
  return { kind: "ok" };
}

/**
 * Whether the head has drifted past the bounds since calibration, so
 * the calibrated point must null rather than guess. AT the bound
 * still holds (the house boundary rule); an unknown on either side —
 * a pose the gate refused, a stored condition never measured — can
 * never convict, because "I cannot tell" is not "you moved".
 */
export function headMovedSinceCalibration(
  conditions: ProfileConditions,
  currentPitchDeg: number | null,
  currentYawDeg: number | null,
  currentIrisWidthPx: number | null,
): boolean {
  if (
    conditions.pitchDeg !== null &&
    currentPitchDeg !== null &&
    Math.abs(currentPitchDeg - conditions.pitchDeg) > GAZE_POSE_DRIFT_DEG
  ) {
    return true;
  }
  if (
    conditions.yawDeg !== null &&
    currentYawDeg !== null &&
    Math.abs(currentYawDeg - conditions.yawDeg) > GAZE_POSE_DRIFT_DEG
  ) {
    return true;
  }
  if (
    conditions.irisWidthPx !== null &&
    conditions.irisWidthPx > 0 &&
    currentIrisWidthPx !== null &&
    Math.abs(currentIrisWidthPx - conditions.irisWidthPx) /
      conditions.irisWidthPx >
      GAZE_IRIS_DRIFT_FRACTION
  ) {
    return true;
  }
  return false;
}
