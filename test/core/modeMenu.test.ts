import { describe, expect, it } from "vitest";

import {
  MODE_PROBE_ASKS,
  modeMenu,
  type ModeProbeReading,
} from "../../src/core/modeMenu";

// Roadmap 13.7, the pure summarizer half. The probe asks the camera
// for a handful of resolution-and-rate trades and records what each
// ask actually negotiated; this module turns those readings into the
// HONEST mode menu — rows keyed by what was DELIVERED in negotiation,
// never by what was asked, because a menu of nominal modes a camera
// will not grant is exactly the dishonesty the row exists to end.

function reading(
  askW: number,
  askH: number,
  askFps: number,
  negW: number | null,
  negH: number | null,
  negFps: number | null,
  applyFailed = false,
): ModeProbeReading {
  return {
    asked: { widthPx: askW, heightPx: askH, fps: askFps },
    negotiated: { widthPx: negW, heightPx: negH, frameRate: negFps },
    applyFailed,
  };
}

describe("rows are keyed by what negotiation delivered", () => {
  it("collapses asks that landed on identical settings into one row", () => {
    // The ordinary webcam case: asked for 1080p60 and 720p60, granted
    // 1080p30 both times. One honest row, both asks recorded on it.
    const menu = modeMenu([
      reading(1920, 1080, 60, 1920, 1080, 30),
      reading(1280, 720, 60, 1920, 1080, 30),
    ]);
    expect(menu.rows).toHaveLength(1);
    expect(menu.rows[0]?.asked).toHaveLength(2);
  });

  it("speaks the negotiated numbers in the label, never the asked ones", () => {
    const menu = modeMenu([reading(1920, 1080, 60, 1920, 1080, 30)]);
    expect(menu.rows[0]?.label).toBe("1920x1080 at 30 fps");
    expect(menu.rows[0]?.label).not.toContain("60");
  });

  it("keeps distinct negotiated settings as distinct rows", () => {
    const menu = modeMenu([
      reading(1920, 1080, 30, 1920, 1080, 30),
      reading(1280, 720, 60, 1280, 720, 60),
    ]);
    expect(menu.rows).toHaveLength(2);
  });
});

describe("what the camera did not grant is recorded, not dropped", () => {
  it("a failed apply lands in notGranted rather than becoming a row", () => {
    const menu = modeMenu([
      reading(1920, 1080, 30, 1920, 1080, 30),
      reading(1280, 720, 60, null, null, null, true),
    ]);
    expect(menu.rows).toHaveLength(1);
    expect(menu.notGranted).toEqual([
      { widthPx: 1280, heightPx: 720, fps: 60 },
    ]);
  });
});

describe("unknown is a status, never a mode", () => {
  it("a reading the browser kept silent about is one unknown row", () => {
    const menu = modeMenu([reading(1920, 1080, 60, null, null, null)]);
    expect(menu.rows).toHaveLength(1);
    expect(menu.rows[0]?.label).toBe("unknown");
    expect(menu.rows[0]?.rateStatus).toBe("unknown");
    // No digit is invented for a silent browser.
    expect(menu.rows[0]?.label).not.toMatch(/\d/);
  });

  it("a known size with an unreported rate stays honest about which half", () => {
    const menu = modeMenu([reading(1920, 1080, 60, 1920, 1080, null)]);
    expect(menu.rows[0]?.label).toBe("1920x1080 at unknown fps");
    expect(menu.rows[0]?.rateStatus).toBe("unknown");
  });
});

describe("the rate verdict speaks the committed bands about a promise", () => {
  it("below the floor reads refused, with the floor named", () => {
    const menu = modeMenu([reading(640, 480, 30, 640, 480, 20)]);
    expect(menu.rows[0]?.rateStatus).toBe("refused");
    expect(menu.rows[0]?.rateSentence).toContain("25");
    expect(menu.rows[0]?.rateSentence).toContain("blink-sample-rate.txt");
  });

  it("the 25-to-60 band reads warned", () => {
    const menu = modeMenu([reading(1920, 1080, 30, 1920, 1080, 30)]);
    expect(menu.rows[0]?.rateStatus).toBe("warned");
    expect(menu.rows[0]?.rateSentence).toContain("25");
    expect(menu.rows[0]?.rateSentence).toContain("60");
  });

  it("at or above 60 reads ok", () => {
    const menu = modeMenu([reading(1280, 720, 60, 1280, 720, 60)]);
    expect(menu.rows[0]?.rateStatus).toBe("ok");
  });

  it("every rate sentence says negotiated, because delivery is measured live", () => {
    // The ladder judges the DELIVERED rate after a session; this menu
    // judges a negotiation before one, and the two must not read as
    // the same claim.
    const menu = modeMenu([
      reading(1920, 1080, 30, 1920, 1080, 30),
      reading(640, 480, 30, 640, 480, 20),
      reading(1280, 720, 60, 1280, 720, 60),
    ]);
    for (const row of menu.rows) {
      expect(row.rateSentence).toContain("negotiated");
      expect(row.rateSentence.toLowerCase()).toContain("delivery is measured");
    }
  });
});

describe("the ruler sentence states the resolution trade relatively", () => {
  it("a narrower mode names its share of the widest mode's pixels", () => {
    const menu = modeMenu([
      reading(1920, 1080, 30, 1920, 1080, 30),
      reading(1280, 720, 60, 1280, 720, 60),
    ]);
    const narrow = menu.rows.find((row) => row.label.startsWith("1280"));
    expect(narrow?.rulerSentence).toContain("67%");
    expect(narrow?.rulerSentence).toContain("pixels per millimetre");
  });

  it("the widest mode says it is the widest rather than 100% of itself", () => {
    const menu = modeMenu([
      reading(1920, 1080, 30, 1920, 1080, 30),
      reading(1280, 720, 60, 1280, 720, 60),
    ]);
    const wide = menu.rows.find((row) => row.label.startsWith("1920"));
    expect(wide?.rulerSentence).toContain("widest");
  });

  it("an unknown width cannot claim a share", () => {
    const menu = modeMenu([reading(1920, 1080, 60, null, null, 30)]);
    expect(menu.rows[0]?.rulerSentence).toContain("unknown");
    expect(menu.rows[0]?.rulerSentence).not.toContain("%");
  });
});

describe("the menu's order is deterministic", () => {
  it("sorts by width descending, then rate descending, unknowns last", () => {
    const menu = modeMenu([
      reading(640, 480, 30, 640, 480, 30),
      reading(1920, 1080, 60, null, null, null),
      reading(1280, 720, 60, 1280, 720, 60),
      reading(1280, 720, 30, 1280, 720, 30),
    ]);
    expect(menu.rows.map((row) => row.label)).toEqual([
      "1280x720 at 60 fps",
      "1280x720 at 30 fps",
      "640x480 at 30 fps",
      "unknown",
    ]);
  });
});

describe("the canonical probe asks", () => {
  it("cover the resolution-versus-rate trade the row names", () => {
    // Full resolution at both rates, and the half-resolution buy of
    // 60 — the three-cornered trade. A list pinned as literals so a
    // reshuffle is a deliberate edit here.
    expect(MODE_PROBE_ASKS).toEqual([
      { widthPx: 1920, heightPx: 1080, fps: 30 },
      { widthPx: 1920, heightPx: 1080, fps: 60 },
      { widthPx: 1280, heightPx: 720, fps: 60 },
    ]);
  });
});
