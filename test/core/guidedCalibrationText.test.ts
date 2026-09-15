import { describe, expect, it } from "vitest";

import {
  GUIDED_CALIBRATION_MIN_SAMPLES,
  GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
} from "../../src/core/constants";
import {
  GUIDED_CALIBRATION_THIN_FACTOR,
  blinkRefusalDetail,
  calibrationResultLine,
  calibrationThinNote,
} from "../../src/core/guidedCalibrationText";

// Roadmap 11.6b: after a guided calibration stores a line, the person
// is shown what it stood on — n_open, n_closed and the separation
// ratio — and a run that cleared its floors with little to spare says
// "thin, consider running it again" instead of looking as settled as
// a comfortable one. Pure wording over numbers, so main.ts renders
// and this file pins the words.

const solid = {
  openSampleCount: 90,
  closedSampleCount: 88,
  separationRatio: 0.75,
};

describe("the result line", () => {
  it("shows the counts and the separation as a percentage", () => {
    expect(calibrationResultLine(solid)).toBe(
      "Measured from 90 open and 88 closed readings; your closed eyes read 75% below your open ones.",
    );
  });

  it("rounds the percentage rather than truncating it", () => {
    expect(
      calibrationResultLine({ ...solid, separationRatio: 0.746 }),
    ).toContain("75%");
    expect(
      calibrationResultLine({ ...solid, separationRatio: 0.744 }),
    ).toContain("74%");
  });

  it("says unknown rather than inventing a percentage from nothing", () => {
    // separationRatio is null for an open median of zero — a shape the
    // parser refuses to store, but this module does not get to assume
    // its caller checked.
    expect(calibrationResultLine({ ...solid, separationRatio: null })).toBe(
      "Measured from 90 open and 88 closed readings; the separation could not be computed.",
    );
  });
});

describe("the thin note", () => {
  it("is absent for a run comfortably above every floor", () => {
    expect(calibrationThinNote(solid)).toBeNull();
  });

  it("appears exactly below the thin line on open samples, and names them", () => {
    const line =
      GUIDED_CALIBRATION_MIN_SAMPLES * GUIDED_CALIBRATION_THIN_FACTOR;
    expect(calibrationThinNote({ ...solid, openSampleCount: line })).toBeNull();
    const note = calibrationThinNote({ ...solid, openSampleCount: line - 1 });
    expect(note).toContain("39 open readings");
    expect(note).toContain("consider running it again");
  });

  it("appears exactly below the thin line on closed samples", () => {
    const line =
      GUIDED_CALIBRATION_MIN_SAMPLES * GUIDED_CALIBRATION_THIN_FACTOR;
    expect(
      calibrationThinNote({ ...solid, closedSampleCount: line }),
    ).toBeNull();
    const note = calibrationThinNote({ ...solid, closedSampleCount: line - 1 });
    expect(note).toContain("39 closed readings");
  });

  it("appears exactly below the thin line on separation", () => {
    const line =
      GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION *
      GUIDED_CALIBRATION_THIN_FACTOR;
    expect(calibrationThinNote({ ...solid, separationRatio: line })).toBeNull();
    const note = calibrationThinNote({
      ...solid,
      separationRatio: line - 0.01,
    });
    expect(note).toContain("39%");
    expect(note).toContain("30%");
  });

  it("marks a run that only just passed its floors as thin", () => {
    // The floors themselves admit these values — the resolver stored
    // the line — but a run with no margin is one bad-luck frame away
    // from a refusal, and saying so is the row's point.
    const note = calibrationThinNote({
      openSampleCount: GUIDED_CALIBRATION_MIN_SAMPLES,
      closedSampleCount: GUIDED_CALIBRATION_MIN_SAMPLES,
      separationRatio: GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
    });
    expect(note).toContain("thin");
    expect(note).toContain("30 open readings");
    expect(note).toContain("30 closed readings");
    expect(note).toContain("consider running it again");
  });

  it("does not call an unknown separation thin", () => {
    // Null means not measured, never "low": a run whose separation
    // could not be computed gets the unknown wording in the result
    // line, not a thinness verdict it never earned.
    expect(calibrationThinNote({ ...solid, separationRatio: null })).toBeNull();
  });
});

describe("the refusal detail, read from what the run saw", () => {
  // Roadmap 11.6b's conditional refusals: the flat sentence names the
  // rule that refused; this detail names what the RUN looked like —
  // a view the camera rarely measured (pose rejections, bad light)
  // versus eyes that closed late versus true non-separation, which
  // keeps the flat sentence because there is nothing more to say.
  const quiet = {
    openFedFrames: 90,
    openNullFrames: 0,
    closedFedFrames: 90,
    closedNullFrames: 0,
    closedApertures: Array.from({ length: 60 }, () => 1),
  };

  it("blames the unmeasured view when most open-step frames had none", () => {
    const detail = blinkRefusalDetail("not-enough-open", {
      ...quiet,
      openFedFrames: 90,
      openNullFrames: 46,
    });
    expect(detail).toContain("open step");
    expect(detail).toContain("no measured view");
  });

  it("stays silent at exactly half unmeasured, and speaks just past it", () => {
    // The boundary is a strict majority: half the frames unmeasured is
    // common on a struggling machine and not yet evidence about the
    // face, so the flat sentence stands there.
    expect(
      blinkRefusalDetail("not-enough-open", {
        ...quiet,
        openFedFrames: 90,
        openNullFrames: 45,
      }),
    ).toBeNull();
    expect(
      blinkRefusalDetail("not-enough-closed", {
        ...quiet,
        closedFedFrames: 90,
        closedNullFrames: 46,
      }),
    ).toContain("closed step");
  });

  it("reads a falling closed trace as eyes that closed late", () => {
    const late = Array.from({ length: 30 }, () => 8).concat(
      Array.from({ length: 30 }, () => 1),
    );
    const detail = blinkRefusalDetail("closure-not-registered", {
      ...quiet,
      closedApertures: late,
    });
    expect(detail).toContain("closed late");
    expect(detail).toContain("as soon as the screen asks");
  });

  it("pins the late-closure boundary on the halves' medians", () => {
    // Second-half median at exactly half the first's is not yet "far
    // below"; a hair under is. The factor is a strict comparison so
    // the boundary cannot drift silently.
    const at = Array.from({ length: 30 }, () => 8).concat(
      Array.from({ length: 30 }, () => 4),
    );
    const under = Array.from({ length: 30 }, () => 8).concat(
      Array.from({ length: 30 }, () => 3.99),
    );
    expect(
      blinkRefusalDetail("closure-not-registered", {
        ...quiet,
        closedApertures: at,
      }),
    ).toBeNull();
    expect(
      blinkRefusalDetail("closure-not-registered", {
        ...quiet,
        closedApertures: under,
      }),
    ).toContain("closed late");
  });

  it("says nothing for true non-separation: a flat closed trace", () => {
    // The flat refusal sentence already names non-separation honestly;
    // a detail invented on top of it would be this module guessing.
    expect(
      blinkRefusalDetail("closure-not-registered", {
        ...quiet,
        closedApertures: Array.from({ length: 60 }, () => 6),
      }),
    ).toBeNull();
  });

  it("says nothing on an empty closed trace, rather than diagnosing nothing", () => {
    expect(
      blinkRefusalDetail("closure-not-registered", {
        ...quiet,
        closedApertures: [],
      }),
    ).toBeNull();
  });

  it("adds nothing to reasons whose sentence already says it all", () => {
    expect(
      blinkRefusalDetail("line-above-open-floor", {
        ...quiet,
        openNullFrames: 89,
      }),
    ).toBeNull();
    expect(
      blinkRefusalDetail("verification-failed", {
        ...quiet,
        closedApertures: [8, 8, 1, 1],
      }),
    ).toBeNull();
  });
});
