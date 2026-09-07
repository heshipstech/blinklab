import { describe, expect, it } from "vitest";

import { BLINK_APERTURE_THRESHOLD_MM } from "../../src/core/constants";
import { EYES_SHUT_FRACTION } from "../../src/core/longClosure";
import {
  LINE_SOURCES,
  blinksWithheld,
  resolveBlinkLine,
  resolveShutLine,
} from "../../src/core/lineProvenance";

// Roadmap 10.13a, ladder A8, audit F-007 and G-Guided b-11. The line
// the detector read travels with the numbers it produced.
//
// A blink is counted when the aperture crosses a line. The duration,
// the amplitude and the peak velocity are all measured from that
// crossing. Three different lines can be in force and they differ by
// millimetres on the same face, so a record that carries the numbers
// without the line carries an answer without its question.
//
// The prediction about what these columns must NOT change was
// committed before this file existed (docs/line-in-the-export.txt,
// previous commit).
//
// This module decides nothing new. It reports the decision the wiring
// already makes, which is why every case below is stated as "what the
// reducer was handed", not as "what the line should be".

const GUIDED = { personalLineMm: 3.4, openMedianMm: 7, closedMedianMm: 1.8 };

describe("the source vocabulary", () => {
  it("is the four the export's column is documented to hold", () => {
    // A fifth value would reach the CSV without the reader's
    // vocabulary growing to meet it.
    expect(LINE_SOURCES).toEqual(["none", "fixed", "passive", "guided"]);
  });
});

describe("which blink line the record should carry", () => {
  it("names the guided line when one is stored", () => {
    // The stored line wins wherever it exists: it is a complete ruler
    // measured from the person's own open and closed aperture.
    expect(resolveBlinkLine(GUIDED, 3.9, false)).toEqual({
      mm: 3.4,
      source: "guided",
    });
  });

  it("names the guided line even when the passive one refused", () => {
    // A refused passive session still counts blinks for a calibrated
    // person, because the guided line IS a line the instrument
    // vouches for. The record must say which line that was.
    expect(resolveBlinkLine(GUIDED, null, true)).toEqual({
      mm: 3.4,
      source: "guided",
    });
  });

  it("names the passive line when the baseline is ready and sound", () => {
    expect(resolveBlinkLine(null, 3.9, false)).toEqual({
      mm: 3.9,
      source: "passive",
    });
  });

  it("carries no line at all before the baseline is ready", () => {
    // Null, never the fallback constant. A frame before the baseline
    // is a frame the detector was fed nothing on, and writing 4 mm
    // there would record a comparison that did not happen.
    expect(resolveBlinkLine(null, null, false)).toEqual({
      mm: null,
      source: "none",
    });
  });

  it("carries no line when the passive session was refused", () => {
    // The refusal withholds the line as well as the numbers. A
    // refused session that still printed its baseline's half would
    // invite a reader to check the blinks against it.
    expect(resolveBlinkLine(null, 3.9, true)).toEqual({
      mm: null,
      source: "none",
    });
  });

  it("never reports `fixed` for a line the wiring did not fall back to", () => {
    // `fixed` exists because the wiring passes BLINK_APERTURE_THRESHOLD_MM
    // to the reducer when it holds no line. The prediction document
    // says that case is unreachable on a corpus clip; the vocabulary
    // still has to be able to say it, or a real fallback would be
    // recorded as `passive` and become invisible.
    expect(resolveBlinkLine(null, null, false, true)).toEqual({
      mm: BLINK_APERTURE_THRESHOLD_MM,
      source: "fixed",
    });
  });

  it("prefers the real line over the fallback when both are available", () => {
    expect(resolveBlinkLine(null, 3.9, false, true)).toEqual({
      mm: 3.9,
      source: "passive",
    });
  });
});

describe("which shut line the record should carry", () => {
  it("is the frozen baseline's shut fraction once it has frozen", () => {
    // Computed from the same function the long-closure detector uses,
    // not restated: a changed fraction must move this column too, or
    // the column would describe a line nobody reads.
    expect(resolveShutLine(7)).toEqual({
      mm: EYES_SHUT_FRACTION * 7,
      source: "passive",
    });
  });

  it("carries no line before the shut baseline freezes", () => {
    expect(resolveShutLine(null)).toEqual({ mm: null, source: "none" });
  });

  it("is never `guided`, because no guided line serves it yet", () => {
    // Whether a guided line SHOULD serve the shut baseline is an open
    // question the ladder holds as an ADR. Wiring it here would
    // answer that question by default rather than by argument, so the
    // shut line has exactly two sources today and this says so.
    const sources = [resolveShutLine(7).source, resolveShutLine(null).source];
    expect(sources).not.toContain("guided");
    expect(sources).not.toContain("fixed");
  });
});

describe("whether the blink numbers are withheld this frame", () => {
  it("withholds on a refused passive session with no guided line", () => {
    expect(blinksWithheld(true, false)).toBe(true);
  });

  it("does not withhold when a guided line is standing in", () => {
    expect(blinksWithheld(true, true)).toBe(false);
  });

  it("does not withhold a sound passive session", () => {
    expect(blinksWithheld(false, false)).toBe(false);
    expect(blinksWithheld(false, true)).toBe(false);
  });

  it("agrees with the line resolution on every combination", () => {
    // The bug this row exists to make impossible: the readout, the
    // record, the report and the log button each decided withholding
    // for themselves, and could disagree. One function decides it now,
    // and a withheld frame must be exactly a frame with no line.
    for (const refused of [true, false]) {
      for (const guided of [GUIDED, null]) {
        for (const baseline of [3.9, null]) {
          const withheld = blinksWithheld(refused, guided !== null);
          const line = resolveBlinkLine(guided, baseline, refused);
          if (withheld) {
            expect(
              line.mm,
              `${String(refused)}/${String(guided !== null)}`,
            ).toBeNull();
            expect(line.source).toBe("none");
          }
        }
      }
    }
  });
});
