import { describe, expect, it } from "vitest";

import {
  EXPORT_NOTHING_RECORDED,
  EXPORT_NO_BLINKS,
  EXPORT_WAITING_FOR_KSS,
  exportedMessage,
} from "../../src/core/exportStatus";

// The export button had three outcomes and only one of them was
// visible. It wrote a file, or it opened the sleepiness question and
// returned, or it hit a bare `return` and did nothing. Two of the three
// produced no file, no error and no message, which from outside is
// indistinguishable from a broken button. The owner reported exactly
// that, and the flow was working: the question was open and the answer
// was what the file was waiting for.

describe("every export outcome says what happened", () => {
  it("names the thing that has to happen next when waiting on the question", () => {
    // "Nothing happened" is what sent the owner looking for a bug. The
    // message has to point at the question, not merely admit a delay.
    expect(EXPORT_WAITING_FOR_KSS).toContain("sleepiness question");
    expect(EXPORT_WAITING_FOR_KSS).toContain("download");
  });

  it("distinguishes an empty session from an empty blink log", () => {
    // Two different nothings. Telling someone "nothing to export" when
    // they measured for three minutes and simply never blinked hard
    // enough would send them chasing the wrong problem.
    expect(EXPORT_NOTHING_RECORDED).toContain("no measurements");
    expect(EXPORT_NO_BLINKS).toContain("no blinks");
    expect(EXPORT_NOTHING_RECORDED).not.toBe(EXPORT_NO_BLINKS);
  });

  it("confirms success by name, because silence is ambiguous in both directions", () => {
    const message = exportedMessage("blinklab-session-2026-08-16.csv");
    expect(message).toContain("blinklab-session-2026-08-16.csv");
    expect(message).toContain("downloads");
  });

  it("says something on every path", () => {
    for (const message of [
      EXPORT_WAITING_FOR_KSS,
      EXPORT_NOTHING_RECORDED,
      EXPORT_NO_BLINKS,
      exportedMessage("a.csv"),
    ]) {
      expect(message.length).toBeGreaterThan(20);
    }
  });
});
