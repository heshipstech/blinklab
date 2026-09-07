// The rules for stepping a clip, kept pure so they can be pinned.
//
// Stepping seeks to every frame of a clip instead of playing it, and
// the schedule it seeks on is learned from the first frames' own
// times. The September 2026 audit found the learning step trusted:
// the SMALLEST gap between the first six frames was taken as the
// period, on the reasoning that a probe can skip a frame and see two
// intervals but never less than one. True for a constant frame rate
// clip; false for anything else. One short gap set a step shorter than
// the clip's period, every later target that fell inside a frame
// already showing produced no frame callback, the stepper fell back to
// the schedule time and counted the frame as new, and a 20 frames per
// second clip reported 40 through the 25 fps refusal.
//
// docs/stepper-honesty.txt pre-registers what follows. Two rules:
// every calibration gap must be a whole multiple of the smallest, and
// a landing the browser could not place on the clip's clock is a
// counted fact that refuses the run past a stated fraction.

/**
 * How far a calibration gap may sit from a whole multiple of the
 * smallest gap before the clip is called variable rate.
 *
 * One millisecond of container timestamp rounding plus margin. A
 * 29.97 fps clip with millisecond timestamps alternates 33 and 34 ms
 * gaps and must calibrate; a 25 ms gap among 40 ms frames is ten
 * milliseconds from any whole multiple and must not.
 */
export const CALIBRATION_QUANTUM_S = 0.0015;

/**
 * The share of sought frames that may land inexactly before the run is
 * refused. Mirrors STEPPING_DUPLICATE_TOLERANCE in frameClock.ts: a
 * seek onto the frame already showing is possible but rare once the
 * step is right, so more than two in a hundred is the step being wrong
 * or a browser that does not report where it lands. Either way the
 * frame has no time of its own.
 */
export const INEXACT_LANDING_TOLERANCE = 0.02;

export type StepCalibration =
  | {
      kind: "calibrated";
      /** The mean period across the calibration frames: the step. */
      periodSeconds: number;
      smallestGapSeconds: number;
      frames: number;
    }
  | { kind: "tooFew"; frames: number }
  | { kind: "implausible"; smallestGapSeconds: number }
  | {
      kind: "variableRate";
      smallestGapSeconds: number;
      /** The first gap that is no whole multiple of the smallest. */
      offendingGapSeconds: number;
    };

/**
 * The step to seek on, from the times of the frames calibration landed
 * on, or the reason there is none.
 *
 * Every gap is compared against the smallest. A gap of two or three
 * intervals is a probe that stepped over a frame, and the SUM of those
 * multiples is how many frame periods the calibration frames span, so
 * the period is that span divided by that sum: the mean, not the
 * smallest. On a clip with exact timestamps the two agree. On a
 * millisecond-quantised clip the smallest gap under-reads the period
 * by up to a millisecond and a schedule built on it drifts a frame
 * every ninety, landing inside frames already showing. That drift is
 * the candidate explanation for the "+1" on two published Eyeblink8
 * clips.
 *
 * A gap that is no whole multiple within the quantum is a variable
 * frame rate as far as the first frames can tell, and the answer is a
 * refusal rather than a step. A glitch of exactly half the period
 * cannot be told from a skipped probe here; the landing check catches
 * that one downstream, because half the targets then land inside
 * frames already showing.
 */
export function calibrateStep(frameTimes: readonly number[]): StepCalibration {
  if (frameTimes.length < 2) {
    return { kind: "tooFew", frames: frameTimes.length };
  }
  const gaps: number[] = [];
  let previous: number | null = null;
  for (const time of frameTimes) {
    if (previous !== null) gaps.push(time - previous);
    previous = time;
  }
  const smallest = Math.min(...gaps);
  // A clip claiming frames a microsecond or ten seconds apart, or one
  // that did not advance, is not something to build a seek schedule on.
  if (!Number.isFinite(smallest) || smallest <= 0.001 || smallest > 1) {
    return { kind: "implausible", smallestGapSeconds: smallest };
  }
  let multiples = 0;
  for (const gap of gaps) {
    const whole = Math.max(1, Math.round(gap / smallest));
    if (Math.abs(gap - whole * smallest) > CALIBRATION_QUANTUM_S + 1e-9) {
      return {
        kind: "variableRate",
        smallestGapSeconds: smallest,
        offendingGapSeconds: gap,
      };
    }
    multiples += whole;
  }
  const span = gaps.reduce((total, gap) => total + gap, 0);
  return {
    kind: "calibrated",
    periodSeconds: span / multiples,
    smallestGapSeconds: smallest,
    frames: frameTimes.length,
  };
}

/** What to tell the operator when the first frames refuse a schedule. */
export function variableRateRefusal(
  result: Extract<StepCalibration, { kind: "variableRate" }>,
): string {
  const offending = (result.offendingGapSeconds * 1000).toFixed(1);
  const smallest = (result.smallestGapSeconds * 1000).toFixed(1);
  return (
    `Could not step this clip: its first frames are not evenly spaced ` +
    `(a gap of ${offending} ms beside one of ${smallest} ms, which is not a ` +
    `whole number of frames), which is what a variable frame rate looks ` +
    `like. Frames cannot be measured one by one on a clock like that. ` +
    `Re-save it as a constant frame rate MP4 and try again.`
  );
}

export type LandingCheck =
  { kind: "ok" } | { kind: "inexactLandings"; sought: number; inexact: number };

/**
 * Did too many sought frames land without a time of their own?
 *
 * An inexact landing is one where no frame callback fired: the seek
 * completed but the browser never said which frame it showed, and the
 * stepper recorded the SCHEDULE time instead. That is right for a
 * constant rate clip and an occasional silent browser, and it is how
 * the same decoded frame came to be measured twice under invented
 * timestamps on a variable rate one. Past the tolerance the run is
 * refused, not summarised.
 */
export function checkLandings(sought: number, inexact: number): LandingCheck {
  if (sought <= 0 || inexact <= sought * INEXACT_LANDING_TOLERANCE) {
    return { kind: "ok" };
  }
  return { kind: "inexactLandings", sought, inexact };
}

/** What to tell the operator when the landings refuse the run. */
export function landingRefusal(check: LandingCheck): string {
  if (check.kind === "ok") return "";
  return (
    `This clip was read frame by frame, but ${String(check.inexact)} of ` +
    `${String(check.sought)} frames could not be placed on the clip's own ` +
    `clock: the browser did not report where the seek landed, which is ` +
    `what happens when a clip has a variable frame rate and a seek lands ` +
    `inside a frame already showing, or when a browser does not report ` +
    `frame times at all. A frame without a time of its own is not a ` +
    `measurement, so this run is refused rather than reported. Re-save ` +
    `the clip as a constant frame rate MP4 and try again, or try another ` +
    `browser.`
  );
}

/** What a stepped run knew about its own schedule, for the export. */
export type SteppingWitness = {
  frameIntervalSeconds: number | null;
  framesSought: number;
  inexactLandings: number;
};

/**
 * The header rows a stepped export carries so the file says what it
 * is: the step it was measured on, how many frames were sought, and
 * how many of those had no time of their own. A session that was not
 * stepped writes none of them, because "not applicable" and "unknown"
 * are different claims.
 */
export function steppingMetadataRows(
  witness: SteppingWitness | null,
): string[] {
  if (witness === null) return [];
  const interval =
    witness.frameIntervalSeconds === null
      ? "unknown"
      : witness.frameIntervalSeconds.toFixed(6);
  return [
    `# frame_interval_s: ${interval}`,
    `# frames_sought: ${String(witness.framesSought)}`,
    `# inexact_landings: ${String(witness.inexactLandings)}`,
  ];
}

/**
 * The smallest a calibration probe may step, whatever the clip says.
 *
 * A clip whose first two landings sit at the same instant would drive
 * the step to zero, and a loop asking for one moment forever is how
 * calibration used to hang before it had an origin rule.
 */
export const PROBE_STEP_FLOOR_S = 0.002;

/**
 * How far the next calibration probe should move, given the landings
 * so far and the bootstrap step to start from.
 *
 * Roadmap 10.14c. The step used to be the constant 10 ms throughout,
 * with a comment claiming it was "under half a frame even at 120
 * frames per second". That was true of the 4 ms it had been; at 10 ms
 * it is TWO whole periods at 200 frames per second. A probe advancing
 * by exactly two periods lands on every other frame, so every gap
 * calibration sees is two periods, the whole-multiple rule is
 * satisfied perfectly by that, and the step comes out at twice the
 * truth. Because two periods is a whole number of frames, every
 * scheduled target then lands exactly on a real frame and the
 * inexact-landing refusal cannot see it. Measured before the fix: 200
 * frames per second calibrated as 100, 240 as 120, 300 as 100.
 *
 * A QUARTER of the smallest gap, not a half. The first gap a fast clip
 * offers may itself be two or three periods, and half of an inflated
 * gap can land back on exactly one period, which is the pathology
 * being escaped. A quarter is under one period even when the estimate
 * it is taken from is four times too large.
 *
 * Never larger than the bootstrap step, so a slow clip cannot make the
 * probe leap further than the constant chosen to be safe for ordinary
 * rates, and never smaller than the floor.
 */
export function probeStep(
  landingsSeconds: readonly number[],
  bootstrapSeconds: number,
): number {
  // Walked with a running previous rather than by index, so there is
  // no index that might be missing and no fallback standing in for a
  // case that cannot happen. Fewer than two landings leaves smallest
  // infinite, which is the one honest "nothing to learn from yet".
  let smallest = Number.POSITIVE_INFINITY;
  let previous: number | null = null;
  for (const time of landingsSeconds) {
    if (previous !== null) {
      smallest = Math.min(smallest, time - previous);
    }
    previous = time;
  }
  if (!Number.isFinite(smallest)) {
    return bootstrapSeconds;
  }
  return Math.min(bootstrapSeconds, Math.max(smallest / 4, PROBE_STEP_FLOOR_S));
}
