import { describe, expect, it } from "vitest";

import { POSE_LIMITS } from "../../src/core/constants";
import {
  POSE_BIAS_CASES,
  apertureRatioAt,
  measuredApertureMm,
  poseBiasSpan,
} from "../../src/core/poseBias";

// Roadmap 10.10c4c, ladder B12 (audit F-086). How much of a published
// millimetre is head angle.
//
// The prediction was committed before this file existed
// (docs/pose-aperture-bias.txt, previous commit), with its algebra
// stated so it can be checked by hand. These are that prediction, one
// assertion each.

const RADIANS = Math.PI / 180;

describe("the prediction, held to the simulation", () => {
  it("1. a nod reads LOW by cos(pitch)", () => {
    // The lid opening foreshortens and the ruler does not.
    const ratio = apertureRatioAt({
      pitchDeg: POSE_LIMITS.maxPitchDeg,
      yawDeg: 0,
      rollDeg: 0,
    });
    expect(ratio).toBeCloseTo(Math.cos(POSE_LIMITS.maxPitchDeg * RADIANS), 6);
    expect(ratio).toBeCloseTo(0.9397, 4);
  });

  it("2. a turn reads HIGH by 1/cos(yaw)", () => {
    // The ruler foreshortens and the lid opening does not.
    const ratio = apertureRatioAt({
      pitchDeg: 0,
      yawDeg: POSE_LIMITS.maxYawDeg,
      rollDeg: 0,
    });
    expect(ratio).toBeCloseTo(1 / Math.cos(POSE_LIMITS.maxYawDeg * RADIANS), 6);
    expect(ratio).toBeCloseTo(1.1034, 4);
  });

  it("3. a tilt is free, exactly", () => {
    // A rotation in the image plane preserves every distance in it, so
    // both the numerator and the denominator are unchanged. Anything
    // beyond floating-point noise here means the simulation is
    // rotating in the wrong space.
    for (const rollDeg of [
      5,
      12,
      POSE_LIMITS.maxRollDeg,
      -POSE_LIMITS.maxRollDeg,
    ]) {
      expect(
        apertureRatioAt({ pitchDeg: 0, yawDeg: 0, rollDeg }),
        `roll ${String(rollDeg)}`,
      ).toBeCloseTo(1, 9);
    }
  });

  it("4. WAS WRONG: they cancel less than cos over cos, 4.9 not 3.7", () => {
    // The prediction was cos(pitch)/cos(yaw) = 1.0368. It is 1.0490,
    // and the missing term is worth keeping because it is geometry
    // rather than noise.
    //
    // Under pitch alone the lid chord shrinks by cos(pitch) and stays
    // vertical. Under pitch AND yaw it does not stay vertical: pitch
    // pushes the chord's endpoints apart in z, and yaw then turns some
    // of that z into x, so the chord acquires a HORIZONTAL component
    // in the image and is longer than cos(pitch) makes it. The chord
    // factor is sqrt(cos^2(pitch) + sin^2(pitch) sin^2(yaw)), which is
    // 0.9507 rather than 0.9397, and over cos(yaw) that is 1.0490.
    //
    // So the two axes cancel LESS than predicted. The prediction
    // stands as written in the document; this assertion is the
    // measurement, and it carries the algebra so it can still be
    // checked by hand.
    const pitch = POSE_LIMITS.maxPitchDeg * RADIANS;
    const yaw = POSE_LIMITS.maxYawDeg * RADIANS;
    const chordFactor = Math.sqrt(
      Math.cos(pitch) ** 2 + (Math.sin(pitch) * Math.sin(yaw)) ** 2,
    );
    const ratio = apertureRatioAt({
      pitchDeg: POSE_LIMITS.maxPitchDeg,
      yawDeg: POSE_LIMITS.maxYawDeg,
      rollDeg: 0,
    });
    expect(ratio).toBeCloseTo(chordFactor / Math.cos(yaw), 6);
    expect(ratio).toBeCloseTo(1.049, 4);
    expect(ratio).toBeGreaterThan(Math.cos(pitch) / Math.cos(yaw));
    // The half that held: still milder than yaw alone, so the worst
    // cases inside the gate remain the single-axis ones.
    expect(Math.abs(ratio - 1)).toBeLessThan(1 / Math.cos(yaw) - 1);
  });

  it("5. the accepted pose region spans about 16 percent", () => {
    const { low, high } = poseBiasSpan();
    expect(low).toBeCloseTo(0.9397, 3);
    expect(high).toBeCloseTo(1.1034, 3);
    expect(high - low).toBeGreaterThan(0.16);
    expect(high - low).toBeLessThan(0.17);
  });

  it("6. the audit's 12 percent for yaw is NOT reproduced", () => {
    // Recorded rather than adopted. This projection is orthographic;
    // 12 percent needs 26.8 degrees, which the gate refuses.
    const atLimit = apertureRatioAt({
      pitchDeg: 0,
      yawDeg: POSE_LIMITS.maxYawDeg,
      rollDeg: 0,
    });
    expect(atLimit - 1).toBeLessThan(0.12);
    expect(1 / Math.cos(26.8 * RADIANS) - 1).toBeCloseTo(0.12, 2);
  });

  it("names the cases the document tabulates", () => {
    // The floor: an empty case list would leave the document's table
    // describing nothing.
    expect(POSE_BIAS_CASES.length).toBe(4);
    for (const entry of POSE_BIAS_CASES) {
      expect(Number.isFinite(apertureRatioAt(entry.pose))).toBe(true);
    }
  });
});

describe("a head with no ruler left", () => {
  it("refuses rather than dividing by a vanished iris", () => {
    // Side-on, far outside anything the gate accepts. The iris ring's
    // horizontal diameter projects to nothing, so there is no ruler to
    // divide by and `apertureMm` returns null. Worth a test because it
    // is the boundary the whole method rests on: the number means
    // something only while the iris is measurable, and the instrument
    // says so rather than returning a large finite guess.
    expect(() =>
      measuredApertureMm({ pitchDeg: 0, yawDeg: 90, rollDeg: 0 }),
    ).toThrow(/no aperture/);
  });

  it("still measures at an angle the gate would refuse but geometry allows", () => {
    // Between the gate's limit and the vanishing point the arithmetic
    // keeps working and keeps getting worse, which is what makes the
    // gate a judgement rather than a fact about the maths.
    const ratio = apertureRatioAt({ pitchDeg: 0, yawDeg: 45, rollDeg: 0 });
    expect(ratio).toBeCloseTo(1 / Math.cos(45 * (Math.PI / 180)), 6);
    expect(ratio).toBeGreaterThan(1.4);
  });
});
