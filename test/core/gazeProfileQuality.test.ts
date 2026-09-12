import { describe, expect, it } from "vitest";

import type { CompletedTarget } from "../../src/core/calibrationCapture";
import {
  GAZE_IRIS_DRIFT_FRACTION,
  GAZE_POSE_DRIFT_DEG,
  GAZE_R2_BOUND,
  GAZE_RMS_BOUND,
  headMovedSinceCalibration,
  parseStoredGazeProfile,
  profileLoadVerdict,
  serializeGazeProfile,
  solveCalibrationOutcome,
  type ProfileConditions,
  type StoredGazeProfile,
} from "../../src/core/calibrationProfile";

// Roadmap 14.9a. The gaze profile used to be four numbers that said
// nothing about how well they fit or what the room looked like when
// they were learned. Now the solve refuses a fit past the PRE-STATED
// bounds (RMS > 0.15 or R² < 0.8, written in the row before any owner
// data was read for the question), the profile carries the conditions
// it was measured under, a stale window refuses on load, and a head
// that moved past the drift bounds nulls the live point.

function capture(
  screens: readonly { x: number; y: number }[],
  offsetFor: (screen: { x: number; y: number }) => {
    horizontal: number;
    vertical: number;
  },
): CompletedTarget[] {
  return screens.map((target) => ({
    target,
    samples: Array.from({ length: 5 }, () => offsetFor(target)),
  }));
}

const GRID = [0.1, 0.5, 0.9].flatMap((x) =>
  [0.1, 0.5, 0.9].map((y) => ({ x, y })),
);

const CONDITIONS: ProfileConditions = {
  pitchDeg: 2,
  yawDeg: -1,
  irisWidthPx: 30,
  viewportWidthPx: 1200,
  viewportHeightPx: 800,
  devicePixelRatio: 2,
  screenWidthPx: 1512,
  screenHeightPx: 982,
  cameraLabel: "Fixture Cam",
};

function stored(overrides?: Partial<StoredGazeProfile>): StoredGazeProfile {
  return {
    horizontal: { slope: 2, intercept: 0.5 },
    vertical: { slope: -2, intercept: 0.5 },
    quality: {
      horizontal: { rmsResidual: 0.02, rSquared: 0.99 },
      vertical: { rmsResidual: 0.03, rSquared: 0.98 },
    },
    conditions: CONDITIONS,
    ...overrides,
  };
}

describe("the solve carries its own quality and refuses past the bounds", () => {
  it("a clean linear capture solves with near-zero residual", () => {
    const outcome = solveCalibrationOutcome(
      capture(GRID, (screen) => ({
        horizontal: (screen.x - 0.5) / 2,
        vertical: (screen.y - 0.5) / -2,
      })),
    );
    expect(outcome.kind).toBe("solved");
    if (outcome.kind === "solved") {
      expect(outcome.quality.horizontal.rmsResidual).toBeLessThan(0.001);
      expect(outcome.quality.horizontal.rSquared).toBeGreaterThan(0.999);
      expect(outcome.quality.vertical.rSquared).toBeGreaterThan(0.999);
    }
  });

  it("the noise-only axis refuses, by name — the row's Check clause", () => {
    // The vertical offset carries NO information about the vertical
    // target: pure noise. A least squares line still fits SOMETHING
    // through it, which is exactly why the quality gate exists —
    // before this row that fit shipped as a calibration.
    let flip = 1;
    const outcome = solveCalibrationOutcome(
      capture(GRID, (screen) => {
        flip = -flip;
        return {
          horizontal: (screen.x - 0.5) / 2,
          vertical: 0.1 * flip,
        };
      }),
    );
    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.axis).toBe("vertical");
      expect(outcome.rSquared).toBeLessThan(GAZE_R2_BOUND);
    }
  });

  it("a degenerate capture is unsolvable, not refused-with-numbers", () => {
    const outcome = solveCalibrationOutcome(
      capture(GRID, () => ({ horizontal: 0.1, vertical: 0.1 })),
    );
    expect(outcome.kind).toBe("unsolvable");
  });

  it("the bounds are the pre-stated ones", () => {
    // Written in the roadmap row before any owner data was read for
    // the question; pinned so a quiet edit reddens.
    expect(GAZE_RMS_BOUND).toBe(0.15);
    expect(GAZE_R2_BOUND).toBe(0.8);
  });
});

describe("the stored profile round-trips with its conditions", () => {
  it("serialize then parse is identity", () => {
    const profile = stored();
    expect(parseStoredGazeProfile(serializeGazeProfile(profile))).toEqual(
      profile,
    );
  });

  it("a v1 profile without conditions reads as no profile", () => {
    // The old format carried no quality and no conditions, so nothing
    // about it can be checked; it parses as null and the page shows
    // uncalibrated, which is the same stance every stale format here
    // gets.
    const v1 = JSON.stringify({
      horizontal: { slope: 2, intercept: 0.5 },
      vertical: { slope: -2, intercept: 0.5 },
    });
    expect(parseStoredGazeProfile(v1)).toBeNull();
  });
});

describe("a pinned profile with a stale window refuses on load", () => {
  const current = {
    viewportWidthPx: 1200,
    viewportHeightPx: 800,
    devicePixelRatio: 2,
    screenWidthPx: 1512,
    screenHeightPx: 982,
    cameraLabel: "Fixture Cam",
  };

  it("matching conditions load", () => {
    expect(profileLoadVerdict(stored(), current).kind).toBe("ok");
  });

  it("a different window refuses, naming the window", () => {
    const verdict = profileLoadVerdict(stored(), {
      ...current,
      viewportWidthPx: 900,
    });
    expect(verdict.kind).toBe("refused");
    if (verdict.kind === "refused") {
      expect(verdict.why).toContain("window");
    }
  });

  it("a different camera refuses, naming the camera", () => {
    const verdict = profileLoadVerdict(stored(), {
      ...current,
      cameraLabel: "Другая камера",
    });
    expect(verdict.kind).toBe("refused");
    if (verdict.kind === "refused") {
      expect(verdict.why).toContain("camera");
    }
  });

  it("an unknown side cannot convict, so it loads", () => {
    // Null means not measured: a camera label the browser withheld is
    // not evidence of a different camera.
    expect(
      profileLoadVerdict(stored(), { ...current, cameraLabel: null }).kind,
    ).toBe("ok");
  });
});

describe("head moved since calibration", () => {
  const conditions = CONDITIONS;

  it("holds still within the bounds, at the boundary included", () => {
    expect(
      headMovedSinceCalibration(
        conditions,
        conditions.pitchDeg,
        conditions.yawDeg,
        conditions.irisWidthPx,
      ),
    ).toBe(false);
    expect(
      headMovedSinceCalibration(
        conditions,
        (conditions.pitchDeg ?? 0) + GAZE_POSE_DRIFT_DEG,
        conditions.yawDeg,
        conditions.irisWidthPx,
      ),
    ).toBe(false);
  });

  it("nulls past five degrees of pitch or yaw", () => {
    expect(
      headMovedSinceCalibration(
        conditions,
        (conditions.pitchDeg ?? 0) + GAZE_POSE_DRIFT_DEG + 0.1,
        conditions.yawDeg,
        conditions.irisWidthPx,
      ),
    ).toBe(true);
  });

  it("nulls past ten percent of iris width, the distance proxy", () => {
    const moved =
      (conditions.irisWidthPx ?? 0) * (1 + GAZE_IRIS_DRIFT_FRACTION) + 0.1;
    expect(
      headMovedSinceCalibration(
        conditions,
        conditions.pitchDeg,
        conditions.yawDeg,
        moved,
      ),
    ).toBe(true);
  });

  it("cannot convict on an unknown, either side", () => {
    expect(headMovedSinceCalibration(conditions, null, null, null)).toBe(false);
    expect(
      headMovedSinceCalibration(
        { ...conditions, pitchDeg: null, yawDeg: null, irisWidthPx: null },
        80,
        80,
        999,
      ),
    ).toBe(false);
  });
});
