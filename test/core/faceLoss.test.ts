import { describe, expect, it } from "vitest";

import {
  FACE_LOSS_REPORT_MS,
  FACE_LOSS_RESET_MS,
  INITIAL_FACE_LOSS,
  type FaceLossState,
  faceLossMetadataRows,
  faceLossSentence,
  faceLossStep,
} from "../../src/core/faceLoss";

// Roadmap 13.13. On 8 September one run of six lost the glasses
// clip's face 39 seconds in and rode the loss to the end of the clip:
// faceDetected false forever, inference at ~1 ms, recall 14.0% for a
// day. The owner accepted this harness — no-face from a chosen frame
// onward — as the reproduction's stand-in, so these tests are the
// event's arbiter: the state machine must escalate a persistent loss
// to a re-acquisition signal instead of coasting, and a loss long
// enough to matter must reach the page and the export.

function drive(
  frames: { t: number; face: boolean }[],
  from: FaceLossState = INITIAL_FACE_LOSS,
): { state: FaceLossState; resetsAt: number[] } {
  let state = from;
  const resetsAt: number[] = [];
  for (const frame of frames) {
    const step = faceLossStep(state, frame.t, frame.face);
    state = step.state;
    if (step.resetDue) {
      resetsAt.push(frame.t);
    }
  }
  return { state, resetsAt };
}

/** Frames at ~33 ms: a face until lostFromMs, none afterwards. */
function lostFrom(lostFromMs: number, untilMs: number) {
  const frames: { t: number; face: boolean }[] = [];
  for (let t = 0; t <= untilMs; t += 33) {
    frames.push({ t, face: t < lostFromMs });
  }
  return frames;
}

describe("a persistent loss escalates instead of coasting", () => {
  it("signals a re-acquisition once the loss reaches the threshold", () => {
    const { state, resetsAt } = drive(lostFrom(1000, 3200));
    expect(resetsAt).toHaveLength(1);
    expect(resetsAt[0]).toBeGreaterThanOrEqual(1000 + FACE_LOSS_RESET_MS);
    expect(state.resets).toBe(1);
  });

  it("keeps re-attempting while the loss continues", () => {
    // The defect rode 39 seconds to the end of the clip after ONE
    // failed acquisition would have been forgivable. Persistence is
    // the point: a signal every threshold, not a single shrug.
    const { state } = drive(lostFrom(1000, 10000));
    expect(state.resets).toBeGreaterThanOrEqual(4);
  });

  it("a blink-length gap never fires", () => {
    const frames = [
      ...lostFrom(400, 800).map((f) => ({ t: f.t, face: f.t < 400 })),
      { t: 833, face: true },
      { t: 866, face: true },
    ];
    const { state, resetsAt } = drive(frames);
    expect(resetsAt).toEqual([]);
    expect(state.resets).toBe(0);
  });

  it("the threshold boundary is inclusive, probed as literals", () => {
    // Face seen at 0, lost from the next frame; the loss clock runs
    // from the first faceless frame at 33.
    const base = [{ t: 0, face: true }];
    const at1999 = drive([
      ...base,
      { t: 33, face: false },
      { t: 2031, face: false },
    ]);
    const at2000 = drive([
      ...base,
      { t: 33, face: false },
      { t: 2033, face: false },
    ]);
    expect(at1999.resetsAt).toEqual([]);
    expect(at2000.resetsAt).toEqual([2033]);
  });
});

describe("a face never found is not a face lost", () => {
  it("an all-faceless session signals nothing", () => {
    // The faceless fake camera and the committed no-face fixture are
    // honest already: their no-face state is the truth, not a loss,
    // and resetting a landmarker that never acquired would thrash.
    const frames = lostFrom(0, 8000).map((f) => ({ t: f.t, face: false }));
    const { state, resetsAt } = drive(frames);
    expect(resetsAt).toEqual([]);
    expect(state.resets).toBe(0);
    expect(faceLossMetadataRows(state)).toEqual([]);
  });
});

describe("the record of the loss", () => {
  it("tracks the longest continuous loss across episodes", () => {
    const frames = [
      ...lostFrom(1000, 4000), // a 3 s loss...
      { t: 4033, face: true }, // ...reacquired,
      { t: 4066, face: false }, // then a shorter one.
      { t: 4600, face: false },
      { t: 4700, face: true },
    ];
    const { state } = drive(frames);
    expect(state.longestLossMs).toBeGreaterThanOrEqual(3000);
    expect(state.longestLossMs).toBeLessThan(3200);
  });

  it("writes both keys once a reset was signalled, and none before", () => {
    const quiet = drive(lostFrom(1000, 2000)).state;
    expect(faceLossMetadataRows(quiet)).toEqual([]);
    const loud = drive(lostFrom(1000, 4000)).state;
    const rows = faceLossMetadataRows(loud);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/^# face_lost_longest_ms: \d+$/);
    expect(rows[1]).toMatch(/^# face_reacquire_resets: \d+$/);
  });

  it("speaks on the page only past the report threshold", () => {
    const three = drive(lostFrom(1000, 4200)).state;
    expect(faceLossSentence(three)).toBeNull();
    const six = drive(lostFrom(1000, 7100)).state;
    const sentence = faceLossSentence(six);
    expect(sentence).toContain("6.1 s");
    expect(sentence).toContain("re-attempted");
  });

  it("the choices are the literals the tests probe", () => {
    expect(FACE_LOSS_RESET_MS).toBe(2000);
    expect(FACE_LOSS_REPORT_MS).toBe(5000);
  });

  it("timestamps that do not move forward throw by name", () => {
    const step = faceLossStep(INITIAL_FACE_LOSS, 100, true);
    expect(() => faceLossStep(step.state, 100, false)).toThrow(/forward/);
  });
});
