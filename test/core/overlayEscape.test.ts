import { describe, expect, it } from "vitest";

import {
  OVERLAYS,
  escapeBlocked,
  escapeCloses,
  overlayById,
  type OverlayId,
} from "../../src/core/overlayEscape";

// Roadmap 14.0f1 [E2]. Four full-viewport overlays and one modal, and
// until this row exactly ONE of them could be left with a key. Row
// 14.0b gave the light stimulus an Escape listener of its own, written
// beside it, and nothing carried that to the other three: a
// keyboard-only visitor who opened the gaze calibration was stuck
// behind it, because the overlay covers the page and nothing on it
// takes focus.
//
// So Escape closes them. Which ones it may close is a rule rather than
// a habit, because the KSS dialog must NOT be among them: every way
// out of that dialog records an answer, and a dismissal that recorded
// nothing would leave a session unable to say whether the question was
// declined or never asked. That distinction lives here, in one list,
// and the page reads its keydown handler and its dialog `cancel`
// interceptor off the same list.

describe("the register of things the page raises over itself", () => {
  it("names every one of them", () => {
    expect(OVERLAYS.map((o) => o.id)).toEqual([
      "calibration-overlay",
      "blink-calibration-overlay",
      "heatmap-overlay",
      "light-overlay",
      "kss-dialog",
    ]);
  });

  it("says why each one is escapable or is not, in words", () => {
    for (const overlay of OVERLAYS) {
      expect(overlay.because.length).toBeGreaterThan(20);
    }
  });

  it("holds the KSS dialog shut against Escape", () => {
    expect(overlayById("kss-dialog").dismissible).toBe(false);
  });

  it("lets Escape out of the four that record nothing", () => {
    for (const id of [
      "calibration-overlay",
      "blink-calibration-overlay",
      "heatmap-overlay",
      "light-overlay",
    ] as const) {
      expect(overlayById(id).dismissible).toBe(true);
    }
  });

  it("refuses an id it does not know, rather than inventing a rule", () => {
    expect(() => overlayById("no-such-overlay" as OverlayId)).toThrow(
      /no-such-overlay/,
    );
  });
});

describe("what Escape closes", () => {
  it("closes nothing when nothing is open, so the key stays the browser's", () => {
    expect(escapeCloses([])).toEqual([]);
  });

  it("closes an open dismissible overlay", () => {
    expect(escapeCloses(["heatmap-overlay"])).toEqual(["heatmap-overlay"]);
  });

  it("closes every open overlay, not the first one it finds", () => {
    // The row's own wording. Two of these are never open together
    // today, and a rule that quietly closed one of two would be a rule
    // nobody could see was wrong until the day it mattered.
    expect(
      escapeCloses(["calibration-overlay", "heatmap-overlay"]),
    ).toHaveLength(2);
  });

  it("leaves the KSS dialog alone even when it is the only thing open", () => {
    expect(escapeCloses(["kss-dialog"])).toEqual([]);
  });

  it("closes nothing at all while the dialog is up, not even behind it", () => {
    // The heatmap is unreachable under a modal anyway, and Escape has
    // to be consumed whole for the dialog to survive a second press.
    // Acting on a key this project has declared inert would be a
    // second rule nobody asked for.
    expect(escapeCloses(["heatmap-overlay", "kss-dialog"])).toEqual([]);
  });

  it("returns ids in the register's order, not the caller's", () => {
    expect(escapeCloses(["heatmap-overlay", "calibration-overlay"])).toEqual([
      "calibration-overlay",
      "heatmap-overlay",
    ]);
  });

  it("says the same thing when an id arrives twice", () => {
    expect(escapeCloses(["heatmap-overlay", "heatmap-overlay"])).toEqual([
      "heatmap-overlay",
    ]);
  });
});

describe("when the key has to be swallowed rather than ignored", () => {
  // Measured, not assumed. A native <dialog> honours preventDefault on
  // its `cancel` event for ONE press: with no user activation in
  // between, Chromium's close watcher fires cancel again, sees it
  // prevented again, and closes anyway. Watched happen in the same
  // Chromium the end-to-end suite drives, on the second press. The
  // refusal therefore cannot live in `cancel`; the keydown has to be
  // stopped before a close request exists at all.

  it("swallows nothing when only dismissible screens are open", () => {
    expect(escapeBlocked(["heatmap-overlay"])).toBe(false);
  });

  it("swallows nothing when nothing is open", () => {
    expect(escapeBlocked([])).toBe(false);
  });

  it("swallows the key while the question is up", () => {
    expect(escapeBlocked(["kss-dialog"])).toBe(true);
  });

  it("swallows it with an overlay open behind the question too", () => {
    expect(escapeBlocked(["heatmap-overlay", "kss-dialog"])).toBe(true);
  });
});
