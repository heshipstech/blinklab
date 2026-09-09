import { describe, expect, it } from "vitest";

import {
  BASELINE_LEARN_MS,
  MAX_BLINK_DURATION_MS,
} from "../../src/core/constants";
import {
  CUE_RESPONSE_WINDOW_MS,
  CUE_SCHEDULE,
  CUE_SETTLE_MS,
  CUE_TOTAL_MS,
  blinkCues,
  answeringDetector,
  cueAt,
  scoreCues,
  type DetectedEvent,
} from "../../src/core/cueSchedule";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 11.0a, ladder C4, audit F-071. The cued ground-truth
// schedule, pure.
//
// Every live claim this project makes about catching blinks rests on
// the count-ten protocol: a person presses Mark, blinks ten times
// counting out loud, presses Mark again. docs/validation-round.txt
// records what that cost — markers stamped up to a second early, one
// participant pressing three times instead of two, and a verdict the
// table had to refuse to call because a marker shift could change it.
// The ground truth was a person operating a button.
//
// Here the ground truth is the schedule. It is fixed in this module
// before any camera runs, so what the person was asked to do and when
// is known to the millisecond, and the only thing left to measure is
// whether the detector saw it.
//
// This row measures nothing itself. It is the instrument 11.6 and
// 13.3 will measure through, which is why there is no prediction
// document beside it: there is no number here to be wrong about yet.

describe("the schedule, fixed before any camera runs", () => {
  it("waits for the baseline before cueing anything", () => {
    // Not a round number chosen for looking tidy. A cue delivered
    // before the baseline is ready would be scored against a detector
    // that holds no line at all, so the settle IS the learning window.
    expect(CUE_SETTLE_MS).toBe(BASELINE_LEARN_MS);
    expect(cueAt(0)).toBe("settle");
    expect(cueAt(CUE_SETTLE_MS - 1)).toBe("settle");
  });

  it("holds the five cue kinds the protocol names", () => {
    const kinds = new Set(CUE_SCHEDULE.map((cue) => cue.kind));
    expect([...kinds].sort()).toEqual([
      "blink",
      "close20",
      "close3",
      "lookAway",
      "rest",
    ]);
  });

  it("cues enough blinks to make a catch rate mean something", () => {
    // Ten, the same number the retired protocol asked for, so a rate
    // from this schedule is comparable with the round I sessions it
    // replaces rather than being a different quantity with the same
    // name.
    expect(blinkCues().length).toBe(10);
  });

  it("runs in order with no gaps and no overlaps", () => {
    // The load-bearing property. A gap is a moment the person was
    // asked nothing and might blink anyway; an overlap is a moment two
    // cues both claim. Either one makes every tally below arguable.
    let expectedStart = CUE_SETTLE_MS;
    for (const cue of CUE_SCHEDULE) {
      expect(cue.atMs, cue.kind).toBe(expectedStart);
      expect(cue.holdMs).toBeGreaterThan(0);
      expectedStart += cue.holdMs;
    }
    expect(CUE_TOTAL_MS).toBe(expectedStart);
  });

  it("rests after every instruction to act", () => {
    // A blink cued while the person is still finishing the last one
    // would be scored against a response that was already under way.
    for (const [index, cue] of CUE_SCHEDULE.entries()) {
      if (cue.kind === "rest") {
        continue;
      }
      expect(CUE_SCHEDULE[index + 1]?.kind, `after ${cue.kind}`).toBe("rest");
    }
  });

  it("holds each closure for the duration its name claims", () => {
    // A cue called close20 that held for three seconds would put a
    // wrong number into every table built on this schedule.
    const three = CUE_SCHEDULE.find((cue) => cue.kind === "close3");
    const twenty = CUE_SCHEDULE.find((cue) => cue.kind === "close20");
    expect(three?.holdMs).toBe(3_000);
    expect(twenty?.holdMs).toBe(20_000);
  });

  it("reads the right cue at a moment inside it, and done after the end", () => {
    const first = CUE_SCHEDULE[0];
    expect(cueAt(CUE_SETTLE_MS)).toEqual(first);
    expect(cueAt(CUE_SETTLE_MS + (first?.holdMs ?? 0) - 1)).toEqual(first);
    expect(cueAt(CUE_TOTAL_MS)).toBe("done");
    expect(cueAt(CUE_TOTAL_MS + 60_000)).toBe("done");
  });

  it("reads settle for a negative elapsed rather than a cue", () => {
    // Should not happen, and must not misread as a measured cue if it
    // does: a clock that ran backwards is not an instruction.
    expect(cueAt(-1)).toBe("settle");
  });
});

describe("the response window, pre-registered", () => {
  it("is long enough for a person to react and finish a blink", () => {
    // A CHOICE, not a derivation, and said so where it is defined. It
    // must at least exceed the longest closure that still counts as a
    // blink, or a blink cued and delivered would be scored a miss for
    // taking as long as blinks are allowed to take.
    expect(CUE_RESPONSE_WINDOW_MS).toBeGreaterThan(MAX_BLINK_DURATION_MS);
  });

  it("is shorter than the rest that follows a cue", () => {
    // Otherwise one cue's window reaches into the next cue's, and a
    // late response to the first would be counted as an early response
    // to the second: a catch rate inflated by arithmetic.
    const rests = CUE_SCHEDULE.filter((cue) => cue.kind === "rest");
    expect(rests.length).toBeGreaterThan(0);
    for (const rest of rests) {
      expect(rest.holdMs).toBeGreaterThan(CUE_RESPONSE_WINDOW_MS);
    }
  });
});

/** One detected blink, as the scorer takes them. */
const at = (startMs: number): DetectedEvent => ({
  kind: "blink",
  startMs,
  durationMs: 120,
});

/** One detected long closure, with the duration the instrument read. */
const closureAt = (startMs: number, durationMs: number): DetectedEvent => ({
  kind: "closure",
  startMs,
  durationMs,
});

/** A closure answering each closure cue, so blink tallies stand alone. */
function closureResponses(): DetectedEvent[] {
  return CUE_SCHEDULE.filter(
    (cue) => cue.kind === "close3" || cue.kind === "close20",
  ).map((cue) => closureAt(cue.atMs + 300, cue.holdMs));
}

describe("scoring a session against the schedule", () => {
  it("catches a blink delivered promptly after each cue", () => {
    const events = [
      ...blinkCues().map((cue) => at(cue.atMs + 300)),
      ...closureResponses(),
    ];
    const score = scoreCues(events, CUE_TOTAL_MS);
    expect(score.kind).toBe("scored");
    if (score.kind !== "scored") return;
    // Twelve scorable cues: ten blinks and two closures. The look-away
    // is not among them, because nothing this scorer reads can see it.
    expect(score.caught).toBe(12);
    expect(score.missed).toBe(0);
    expect(score.medianLatencyMs).toBe(300);
  });

  it("counts a cue with no response as missed, not as absent", () => {
    const cues = blinkCues();
    const events = cues.slice(0, 7).map((cue) => at(cue.atMs + 250));
    const score = scoreCues(events, CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.caught).toBe(7);
    // Three unanswered blinks and both unanswered closures.
    expect(score.missed).toBe(5);
    // Every scorable cue is accounted for. A tally that silently
    // dropped the missed ones would report 7 of 7.
    expect(score.outcomes.length).toBe(cues.length + 2);
  });

  it("does not count a response that arrived after the window", () => {
    const cues = blinkCues();
    const late = CUE_RESPONSE_WINDOW_MS + 1;
    const events = cues.map((cue) => at(cue.atMs + late));
    const score = scoreCues(events, CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.caught).toBe(0);
    expect(score.missed).toBe(12);
  });

  it("counts one cue at most once, however many blinks arrive", () => {
    // A person who blinks five times at one cue has not caught five
    // cues. Without this the adversarial stream below would score
    // brilliantly by blinking constantly.
    const cue = blinkCues()[0];
    if (cue === undefined) throw new Error("no cues");
    const events = [0, 100, 200, 300, 400].map((d) => at(cue.atMs + d));
    const score = scoreCues(events, CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.caught).toBe(1);
  });

  it("scores an ignore-the-cues stream at zero, never a faked success", () => {
    // The adversarial case the row exists to make impossible. A
    // detector that fires constantly, or a person who blinks
    // continuously without watching, must not be rewarded: every cue
    // would have a blink near it by luck.
    //
    // It scores zero here because the events are placed in the RESTS,
    // never in a response window. A stream that blinks every 200 ms
    // throughout is a different adversary and is the next test.
    const events: DetectedEvent[] = [];
    for (const rest of CUE_SCHEDULE.filter((cue) => cue.kind === "rest")) {
      events.push(at(rest.atMs + CUE_RESPONSE_WINDOW_MS + 100));
    }
    const score = scoreCues(events, CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.caught).toBe(0);
  });

  it("is honest that a constant blinker catches everything", () => {
    // Stated rather than defended against, because it cannot be
    // defended against by a scorer: somebody blinking every 200 ms
    // does respond to every cue, and no arrangement of windows can
    // tell that apart from obedience. What protects the measurement is
    // the RATE, not the scorer: a session whose blink count far
    // exceeds its cue count is not a scored session, and 11.0b's
    // export carries both numbers so the reader can see it.
    const events: DetectedEvent[] = [];
    for (let t = CUE_SETTLE_MS; t < CUE_TOTAL_MS; t += 200) {
      events.push(at(t));
    }
    const score = scoreCues(events, CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    // Every blink cue, and neither closure: blinking constantly does
    // not answer "close your eyes for twenty seconds", because the
    // events carry which detector produced them.
    expect(score.caught).toBe(10);
    // And the count that gives the adversary away is reported beside
    // the tally.
    expect(score.eventsSeen).toBe(events.length);
    expect(score.eventsSeen).toBeGreaterThan(score.caught * 5);
  });
});

describe("what the scorer refuses", () => {
  it("refuses a session that ended before the schedule did", () => {
    // An uncued session: the person stopped early, so the cues after
    // the end were never delivered and scoring them as missed would
    // blame the detector for the protocol.
    const score = scoreCues([], CUE_TOTAL_MS - 1);
    expect(score).toEqual({ kind: "refused", reason: "session-too-short" });
  });

  it("refuses a session that ran far past the schedule", () => {
    // Over-long: the clock drifted or the person kept the camera
    // running, and events from after the last cue would be scored
    // against cues that had finished.
    const score = scoreCues([], CUE_TOTAL_MS * 2);
    expect(score).toEqual({ kind: "refused", reason: "session-too-long" });
  });

  it("refuses an event that arrived before the first cue", () => {
    // The settle is not a cue. A blink during it is an ordinary blink,
    // and a session carrying events from before the protocol started
    // was not run to the protocol.
    const score = scoreCues([at(CUE_SETTLE_MS - 1)], CUE_TOTAL_MS);
    expect(score).toEqual({
      kind: "refused",
      reason: "event-before-first-cue",
    });
  });

  it("scores a session that ran a little past the end", () => {
    // The export button is pressed by a person, so the recording
    // always runs slightly past the last cue. A refusal that fired on
    // that would refuse every real session.
    const score = scoreCues([], CUE_TOTAL_MS + 5_000);
    expect(score.kind).toBe("scored");
  });
});

describe("which detector can answer which cue", () => {
  it("pairs each cue with the detector that could see it", () => {
    expect(answeringDetector("blink")).toBe("blink");
    expect(answeringDetector("close3")).toBe("closure");
    expect(answeringDetector("close20")).toBe("closure");
  });

  it("says nothing can answer a look-away, rather than guessing", () => {
    // Gaze sees a person turning away; the blink and closure paths do
    // not. Scoring it against a closure would make a look-away that
    // produced no blink read as a detector miss, which would be a
    // number about nothing.
    expect(answeringDetector("lookAway")).toBeNull();
    expect(answeringDetector("rest")).toBeNull();
  });

  it("keeps the look-away out of the tally entirely", () => {
    const score = scoreCues(
      [...blinkCues().map((cue) => at(cue.atMs + 300)), ...closureResponses()],
      CUE_TOTAL_MS,
    );
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.outcomes.some((o) => o.cue.kind === "lookAway")).toBe(false);
  });

  it("does not let a blink answer a closure cue", () => {
    // The conflation this module's first version had. A twenty-second
    // instruction answered by a 120 ms blink is not a catch.
    const cue = CUE_SCHEDULE.find((c) => c.kind === "close20");
    if (cue === undefined) throw new Error("no closure cue");
    const score = scoreCues([at(cue.atMs + 200)], CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    const outcome = score.outcomes.find((o) => o.cue.kind === "close20");
    expect(outcome?.caught).toBe(false);
  });

  it("does not let a closure answer a blink cue", () => {
    const cue = blinkCues()[0];
    if (cue === undefined) throw new Error("no blink cue");
    const score = scoreCues([closureAt(cue.atMs + 200, 3_000)], CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.outcomes[0]?.caught).toBe(false);
  });
});

describe("how well a cued closure was timed", () => {
  it("reports the error against the cued duration, signed", () => {
    // The number row 13.3 wants. A closure cued at twenty seconds and
    // measured at eighteen is not a miss, it is a two-second error,
    // and a pass mark here would throw that away and invent a bar.
    const cue = CUE_SCHEDULE.find((c) => c.kind === "close20");
    if (cue === undefined) throw new Error("no closure cue");
    const score = scoreCues([closureAt(cue.atMs + 400, 18_000)], CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    const outcome = score.outcomes.find((o) => o.cue.kind === "close20");
    expect(outcome?.caught).toBe(true);
    expect(outcome?.durationErrorMs).toBe(-2_000);
  });

  it("is null for a blink cue, which has no cued duration to miss", () => {
    const events = blinkCues().map((cue) => at(cue.atMs + 300));
    const score = scoreCues(events, CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    expect(score.outcomes[0]?.durationErrorMs).toBeNull();
  });

  it("is null for a closure cue nothing answered", () => {
    // Never zero. A missed closure has no measured duration, and a
    // zero error would read as a perfectly timed one.
    const score = scoreCues([], CUE_TOTAL_MS);
    if (score.kind !== "scored") throw new Error("refused");
    const outcome = score.outcomes.find((o) => o.cue.kind === "close3");
    expect(outcome?.caught).toBe(false);
    expect(outcome?.durationErrorMs).toBeNull();
  });
});

describe("the protocol this replaces", () => {
  it("is named as retired where a participant would read it", () => {
    // Not a comment in a source file nobody running a study opens.
    // The instructions are the document a participant is handed, and
    // the retirement has to be at the top of the steps rather than in
    // a changelog, or somebody designs a new study on the old
    // protocol.
    // Quote markers and line wrapping removed before matching. The
    // notice is a blockquote that the formatter reflows, and a test
    // that reddened when a sentence moved onto the next line would be
    // testing the wrapping rather than what the document says.
    const doc = readRepoFile("docs/participant-instructions.md", repoRoot())
      .replace(/^>\s?/gm, "")
      .replace(/\s+/g, " ");
    expect(doc).toContain("RETIRED, 7 September 2026");
    expect(doc).toContain("roadmap 11.0a");
    // The reason, not merely the fact: a retirement with no reason
    // invites somebody to decide it was retired by mistake.
    expect(doc).toContain("made the participant part of the instrument");
    expect(doc).toContain("src/core/cueSchedule.ts");
    // And the sessions already recorded stay usable, which somebody
    // reading a retirement notice will want to know.
    expect(doc).toContain("stay valid for what they measured");
  });
});
