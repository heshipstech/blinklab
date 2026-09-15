import { describe, expect, it } from "vitest";

import {
  GUIDED_CALIBRATION_MIN_SAMPLES,
  GUIDED_CALIBRATION_MIN_SEPARATION_FRACTION,
} from "../../src/core/constants";
import {
  GUIDED_CALIBRATION_THIN_FACTOR,
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
