// Roadmap 14.2: the podium view's sizes, as constants a test can
// hold a floor under rather than styles buried in the wiring. The
// row's third Check clause is "the demo notice stays legible at
// distance", and legibility at distance is a SIZE — a clause pinned
// on a number stays true or goes red, where a clause pinned on
// somebody's memory of a stylesheet just goes quiet.

// The headline. 96 CSS pixels is six times the page's body size:
// on a projected 1080p screen the score line is roughly a tenth of
// the screen's height, which is what "read it from the back" means
// in a number.
export const PODIUM_SCORE_FONT_PX = 96;

// Everything else on the podium, the demo notice first among them.
// 28 CSS pixels is well above the page's own body size; the floor
// the test holds is 24, below which a fullscreen caveat starts to
// read as fine print — and a projected number whose caveat reads as
// fine print is the exact dishonesty the notice exists to prevent.
export const PODIUM_TEXT_FONT_PX = 28;
