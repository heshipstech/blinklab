import { describe, expect, it } from "vitest";

import { scoreSentence } from "../../src/core/scoreSentence";

// Roadmap 14.2's second Check clause, made true by construction: the
// score readout and the podium big view must share the identical
// formatted string for a null, so the string lives in ONE function
// and these tests pin its four branches verbatim — the same strings
// docs/UI.md documents for the readout, moved rather than retyped.
describe("scoreSentence", () => {
  it("speaks the number when a score exists", () => {
    expect(
      scoreSentence({
        calibrationRefused: false,
        score: 72,
        faceDetected: true,
      }),
    ).toBe("Alertness score: 72 / 100");
  });

  it("withholds under a refused calibration, whatever else is true", () => {
    // The refusal outranks everything: a refused session has no
    // ruler, so even a computed-looking score would be a number
    // wearing a costume.
    expect(
      scoreSentence({
        calibrationRefused: true,
        score: 72,
        faceDetected: true,
      }),
    ).toBe("Alertness score: withheld, calibration was refused");
  });

  it("names the empty chair rather than scoring it", () => {
    expect(
      scoreSentence({
        calibrationRefused: false,
        score: null,
        faceDetected: false,
      }),
    ).toBe("Alertness score: no face in frame");
  });

  it("says measuring while the window has no verdict yet", () => {
    expect(
      scoreSentence({
        calibrationRefused: false,
        score: null,
        faceDetected: true,
      }),
    ).toBe("Alertness score: measuring...");
    expect(
      scoreSentence({
        calibrationRefused: false,
        score: null,
        faceDetected: undefined,
      }),
    ).toBe("Alertness score: measuring...");
  });

  it("never renders a null as a zero", () => {
    // The podium clause, as a property: with no score there is no
    // digit in the sentence at all, so no projector can show "0"
    // about an empty chair.
    for (const faceDetected of [true, false, undefined]) {
      for (const calibrationRefused of [true, false]) {
        const sentence = scoreSentence({
          calibrationRefused,
          score: null,
          faceDetected,
        });
        expect(sentence).not.toMatch(/\d/);
      }
    }
  });
});
