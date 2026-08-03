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

export function solveCalibration(
  completed: readonly CompletedTarget[],
): CalibrationProfile | null {
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
  const horizontal = fitLine(
    medians.map((m) => ({ offset: m.median.horizontal, screen: m.target.x })),
  );
  const vertical = fitLine(
    medians.map((m) => ({ offset: m.median.vertical, screen: m.target.y })),
  );
  // A profile that could answer only one axis would misclassify the
  // other with confidence, so it is all or nothing.
  if (horizontal === null || vertical === null) {
    return null;
  }
  return { horizontal, vertical };
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
