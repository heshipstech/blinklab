import { describe, expect, it } from "vitest";

import {
  PODIUM_SCORE_FONT_PX,
  PODIUM_TEXT_FONT_PX,
} from "../../src/core/podiumView";

// Roadmap 14.2's third Check clause, held on numbers: legibility at
// distance is a size, and a size can go red.
describe("the podium's sizes", () => {
  it("keeps the score readable from the back of a room", () => {
    expect(PODIUM_SCORE_FONT_PX).toBeGreaterThanOrEqual(72);
  });

  it("keeps the demo notice legible at distance, never fine print", () => {
    // The clause's floor: below 24 CSS pixels a fullscreen caveat
    // starts to read as fine print, and a projected number whose
    // caveat reads as fine print is the dishonesty the notice
    // exists to prevent.
    expect(PODIUM_TEXT_FONT_PX).toBeGreaterThanOrEqual(24);
  });

  it("keeps the headline the headline", () => {
    expect(PODIUM_SCORE_FONT_PX).toBeGreaterThan(PODIUM_TEXT_FONT_PX);
  });
});
